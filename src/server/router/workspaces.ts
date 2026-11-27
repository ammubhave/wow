import {ORPCError} from "@orpc/server";
import {env, waitUntil} from "cloudflare:workers";
import {and, count, eq, exists, inArray, isNotNull, max, ne, or, type SQL, sql} from "drizzle-orm";
import {alias} from "drizzle-orm/sqlite-core";
import {z} from "zod";

import {auth} from "@/lib/auth";
import {chunks} from "@/lib/chunks";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {newTourState, tourStateSchema} from "@/lib/tour-state";
import {parseTheme, workspaceThemeSchema} from "@/lib/workspace-theme";

import {fetchDiscord} from "../do/discord-client";
import {
  getActivityLogEntries,
  getWorkspaceRoom,
  invalidateWorkspace,
  type WorkspaceRoomWireState,
} from "../do/workspace";
import {startDriveAccess} from "../drive-access";
import {DRIVE_DISCONNECTED_DETAIL, shareDriveFolder} from "../drive-share";
import {trackServerEvent} from "../posthog";
import {getWorkspaceCost} from "../usage-cost";
import {toWorkspaceRole} from "../workspace-access";
import {type AuthedContext, preauthorize, procedure, requireOwner} from "./base";

const ACTIVITY_LOG_PAGE_SIZE = 50;
const EMAILS_PAGE_SIZE = 30;

/** A date input in ms: undefined leaves it alone, null clears it. */
const toDate = (ms: number | null | undefined) =>
  ms === undefined ? undefined : ms === null ? null : new Date(ms);

// The theme is edited in SQL (one UPDATE each), not read, changed and written back: two teammates
// adding emoji at once, or an emoji added while the owner changes the accent, must not undo each
// other. `themeJson` is the stored theme, or {} when unset (or not valid JSON).
const themeColumn = schema.organization.theme;
const themeJson = sql`(case when json_valid(${themeColumn}) then ${themeColumn} else '{}' end)`;

/** Archived workspaces are read-only, and that includes who's in them. */
const ARCHIVED_JOIN_MESSAGE = "This workspace is archived, so it isn't taking new members.";

/** Whether `userId` is a member of the workspace. */
const isMember = async (workspaceId: string, userId: string) =>
  (await db
    .select({id: schema.member.id})
    .from(schema.member)
    .where(and(eq(schema.member.organizationId, workspaceId), eq(schema.member.userId, userId)))
    .get()) !== undefined;

/** Whether the workspace has an owner other than `userId` (as part of a statement). */
const anotherOwner = (workspaceId: string, userId: string) => {
  const other = alias(schema.member, "other");
  return exists(
    db
      .select({id: other.id})
      .from(other)
      .where(
        and(
          eq(other.organizationId, workspaceId),
          eq(other.role, "owner"),
          ne(other.userId, userId)
        )
      )
  );
};

export const workspacesRouter = {
  /** What the join page shows before you're in: the team, its look, and how many are already in. */
  getPublic: procedure.input(z.string()).handler(async ({input}) => {
    const workspace = await db
      .select({
        id: schema.organization.id,
        teamName: schema.organization.teamName,
        eventName: schema.organization.eventName,
        theme: schema.organization.theme,
        archivedAt: schema.organization.archivedAt,
      })
      .from(schema.organization)
      .where(eq(schema.organization.slug, input))
      .get();
    if (!workspace) throw new ORPCError("NOT_FOUND");
    const [{members} = {members: 0}] = await db
      .select({members: count()})
      .from(schema.member)
      .where(eq(schema.member.organizationId, workspace.id));
    const {accent, emoji} = parseTheme(workspace.theme);
    return {
      teamName: workspace.teamName,
      eventName: workspace.eventName,
      accent,
      emoji,
      members,
      // Archived workspaces take no new members (see `join`).
      archived: workspace.archivedAt !== null,
    };
  }),
  /** What the workspace has cost to run so far (src/server/usage-cost.ts), for any member. */
  cost: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(({context}) => getWorkspaceCost(context.workspace.id)),
  join: procedure
    .input(z.object({workspaceSlug: z.string(), password: z.string()}))
    .handler(async ({context, input}) => {
      // Slows password guessing: a few tries a minute per account (binding in wrangler.jsonc).
      const {success} = await env.JOIN_RATE_LIMIT.limit({key: context.session.user.id});
      if (!success) {
        throw new ORPCError("TOO_MANY_REQUESTS", {
          message: "Too many attempts. Wait a minute, then try again.",
        });
      }
      const workspace = await db
        .select({
          id: schema.organization.id,
          name: schema.organization.name,
          slug: schema.organization.slug,
          googleFolderId: schema.organization.googleFolderId,
          archivedAt: schema.organization.archivedAt,
        })
        .from(schema.organization)
        .where(
          and(
            eq(schema.organization.slug, input.workspaceSlug),
            eq(schema.organization.password, input.password)
          )
        )
        .get();
      if (!workspace) {
        // One answer for a wrong ID and a wrong password, so IDs can't be probed.
        throw new ORPCError("FORBIDDEN", {
          message: "No workspace matches that ID and password. Check both and try again.",
        });
      }
      // Already in (a double submit, or the join link opened again): just go to the workspace.
      // addMember would throw "User is already a member", which surfaced as a failed join.
      const existing = await db
        .select({id: schema.member.id})
        .from(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, workspace.id),
            eq(schema.member.userId, context.session.user.id)
          )
        )
        .get();
      if (existing) return {id: workspace.id, name: workspace.name, slug: workspace.slug};
      if (workspace.archivedAt) throw new ORPCError("CONFLICT", {message: ARCHIVED_JOIN_MESSAGE});
      try {
        await auth.api.addMember({
          // Joining with the password makes you a member; owners can promote people after.
          body: {userId: context.session.user.id, role: "member", organizationId: workspace.id},
        });
      } catch (error) {
        // Another request joined first (a double click, two tabs): the unique index on member
        // refused this one. Only the first one welcomes them.
        if (await isMember(workspace.id, context.session.user.id)) {
          return {id: workspace.id, name: workspace.name, slug: workspace.slug};
        }
        throw error;
      }
      await welcomeNewMember(context, workspace, "password");
      // Never return the full row: it holds the Google OAuth tokens and the join password.
      return {id: workspace.id, name: workspace.name, slug: workspace.slug};
    }),

  update: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        teamName: z.string().min(1).optional(),
        eventName: z.string().min(1).optional(),
        password: z.string().min(8).optional(),
        comment: z
          .string()
          .transform(val => (val.length === 0 ? null : val))
          .nullable()
          .optional(),
        tags: z.array(z.string()).optional(),
        // Web links only: a javascript: or data: URL would run as whoever opens it.
        links: z.array(z.object({name: z.string(), url: z.url({protocol: /^https?$/})})).optional(),
        // Optional hunt clock (ms since epoch; null clears it).
        huntStartsAt: z.number().nullable().optional(),
        huntEndsAt: z.number().nullable().optional(),
        // Where the hunt is: "Online", a city, … (empty clears it).
        huntLocation: z
          .string()
          .trim()
          .max(200)
          .transform(val => (val.length === 0 ? null : val))
          .nullable()
          .optional(),
        // The workspace's look (custom emoji have their own procedures).
        accent: workspaceThemeSchema.shape.accent,
        emoji: z.string().max(16).nullable().optional(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      // Anyone can edit the comment, tags and links; the rest is for owners.
      const ownerFields = [
        input.teamName,
        input.eventName,
        input.password,
        input.huntStartsAt,
        input.huntEndsAt,
        input.huntLocation,
        input.accent,
        input.emoji,
      ];
      if (context.role !== "owner" && ownerFields.some(value => value !== undefined)) {
        throw new ORPCError("FORBIDDEN", {
          message:
            "Only workspace owners can change the team or event name, password, hunt dates and location, or look.",
        });
      }
      let theme: SQL | undefined;
      if (input.accent !== undefined || input.emoji !== undefined) {
        theme = themeJson;
        if (input.accent !== undefined)
          theme = sql`json_set(${theme}, '$.accent', ${input.accent})`;
        if (input.emoji === null) theme = sql`json_remove(${theme}, '$.emoji')`;
        else if (input.emoji !== undefined) {
          theme = sql`json_set(${theme}, '$.emoji', ${input.emoji})`;
        }
      }
      let commentUpdatedAt = undefined;
      let commentUpdatedBy = undefined;
      if (input.comment !== undefined) {
        commentUpdatedAt = new Date();
        commentUpdatedBy = context.session.user.name;
      }

      const [workspace] = await db
        .update(schema.organization)
        .set({
          teamName: input.teamName,
          eventName: input.eventName,
          password: input.password,
          comment: input.comment,
          commentUpdatedAt,
          commentUpdatedBy,
          tags: input.tags,
          links: input.links,
          huntStartsAt: toDate(input.huntStartsAt),
          huntEndsAt: toDate(input.huntEndsAt),
          huntLocation: input.huntLocation,
          theme,
        })
        .where(eq(schema.organization.id, context.workspace.id))
        .returning();
      if (!workspace) throw new ORPCError("NOT_FOUND");
      await invalidateWorkspace(workspace.id);
    }),

  delete: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .use(requireOwner)
    .handler(async () => {
      throw new Error(
        "Workspace deletion has been disabled. Contact support to delete your workspace."
      );
    }),

  leave: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      // One statement, so two owners leaving (or one leaving as the other steps down) at the same
      // moment can't leave the workspace with no owner.
      const left = await db
        .delete(schema.member)
        .where(
          and(
            eq(schema.member.organizationId, context.workspace.id),
            eq(schema.member.userId, context.session.user.id),
            or(
              ne(schema.member.role, "owner"),
              anotherOwner(context.workspace.id, context.session.user.id)
            )
          )
        )
        .returning({id: schema.member.id});
      if (left.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "You're the only owner. Make someone else an owner first, then leave.",
        });
      }
      // Their access to the team's Drive folder goes too, in the background.
      if (context.workspace.googleFolderId) {
        const {id, name, email} = context.session.user;
        waitUntil(startDriveAccess([{workspaceId: context.workspace.id, userId: id, name, email}]));
      }
    }),

  getGoogleTokenState: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      const googleAccessToken = await context.google.getAccessToken(context.workspace.id);
      if (!googleAccessToken) {
        return {state: 0} as const;
      }
      let resp = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "GET",
        headers: {Authorization: `Bearer ${googleAccessToken}`},
      });
      if (resp.status !== 200) {
        return {state: 0} as const;
      }

      if (!context.workspace.googleFolderId) {
        return {state: 1} as const;
      }
      resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${context.workspace.googleFolderId}`,
        {method: "GET", headers: {Authorization: `Bearer ${googleAccessToken}`}}
      );
      if (resp.status !== 200) {
        return {state: 1} as const;
      }

      const folder = z.object({id: z.string(), name: z.string()}).parse(await resp.json());
      const folderName = folder.name;
      const folderLink = `https://drive.google.com/drive/folders/${folder.id}`;
      if (!context.workspace.googleTemplateFileId) {
        return {state: 2, folderName, folderLink} as const;
      }

      resp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${context.workspace.googleTemplateFileId}`,
        {method: "GET", headers: {Authorization: `Bearer ${googleAccessToken}`}}
      );
      if (resp.status !== 200) {
        return {state: 2, folderName, folderLink} as const;
      }
      const file = z.object({id: z.string(), name: z.string()}).parse(await resp.json());
      const fileName = file.name;
      const fileLink = `https://docs.google.com/spreadsheets/d/${file.id}/edit?gid=0#gid=0`;
      return {state: 3, folderName, folderLink, fileName, fileLink} as const;
    }),

  setGoogleFolderId: procedure
    .input(z.object({workspaceSlug: z.string(), folderId: z.string()}))
    .use(preauthorize)
    .use(requireOwner)
    .handler(async ({context, input}) => {
      await db
        .update(schema.organization)
        .set({googleFolderId: input.folderId})
        .where(eq(schema.organization.id, context.workspace.id));
      await invalidateWorkspace(context.workspace.id);
    }),

  setGoogleTemplateFileId: procedure
    .input(z.object({workspaceSlug: z.string(), fileId: z.string()}))
    .use(preauthorize)
    .use(requireOwner)
    .handler(async ({context, input}) => {
      await db
        .update(schema.organization)
        .set({googleTemplateFileId: input.fileId})
        .where(eq(schema.organization.id, context.workspace.id));
      await invalidateWorkspace(context.workspace.id);
    }),

  /// The team's choice of tools: built-in or Google sheets for new puzzles, WOW or Discord calls.
  /// Only a preference: switching never disconnects anything, so existing Google Sheets and
  /// Discord channels keep working, and switching back picks up where it left off.
  setTools: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        sheetsTool: z.enum(["builtin", "google"]).optional(),
        voiceTool: z.enum(["builtin", "discord"]).optional(),
      })
    )
    .use(preauthorize)
    .use(requireOwner)
    .handler(async ({context, input}) => {
      await db
        .update(schema.organization)
        .set({sheetsTool: input.sheetsTool, voiceTool: input.voiceTool})
        .where(eq(schema.organization.id, context.workspace.id));
      await invalidateWorkspace(context.workspace.id);
      // Back on Discord: catch its channels up with the board.
      if (input.voiceTool === "discord") waitUntil(context.discord.sync(context.workspace.id));
    }),

  /// Archives the workspace (or brings it back): it's hidden from everyone's workspace list until
  /// unarchived. Nothing else changes, and nothing is deleted.
  setArchived: procedure
    .input(z.object({workspaceSlug: z.string(), archived: z.boolean()}))
    .use(preauthorize)
    .use(requireOwner)
    .handler(async ({context, input}) => {
      await db
        .update(schema.organization)
        .set({archivedAt: input.archived ? new Date() : null})
        .where(eq(schema.organization.id, context.workspace.id));
      await invalidateWorkspace(context.workspace.id);
    }),

  /// Shares the Drive folder with every member again: for people who joined while sharing
  /// failed (a file added to the folder outside WOW, or an expired Google connection), or before
  /// the folder was chosen. Sharing with someone who already has access changes nothing.
  shareGoogleDriveFolderWithMembers: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .use(requireOwner)
    .handler(async ({context}) => {
      const workspace = context.workspace;
      if (!workspace.googleFolderId) {
        throw new ORPCError("BAD_REQUEST", {message: "Choose a Google Drive folder first."});
      }
      const googleAccessToken = await context.google.getAccessToken(workspace.id);
      if (!googleAccessToken) {
        throw new ORPCError("BAD_REQUEST", {message: DRIVE_DISCONNECTED_DETAIL});
      }
      const members = await db
        .select({name: schema.user.name, email: schema.user.email})
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(eq(schema.member.organizationId, workspace.id));
      let shared = 0;
      const failed: {name: string; email: string; detail: string}[] = [];
      // One at a time: a blocked folder fails for everyone, so the first failure can end it.
      for (const member of members) {
        // oxlint-disable-next-line no-await-in-loop -- see above.
        const result = await shareDriveFolder(
          googleAccessToken,
          workspace.googleFolderId,
          member.email
        );
        if (result.ok) {
          shared++;
          continue;
        }
        // A file added outside WOW blocks the folder for everyone: no use trying the rest.
        if (result.blocked) {
          return {shared, failed, blocked: result};
        }
        failed.push({...member, detail: result.detail});
      }
      return {shared, failed, blocked: null};
    }),

  /// The live workspace room state (also pushed over the websocket), for the initial render.
  state: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}): Promise<WorkspaceRoomWireState> => {
      // The room serializes once per change; parse here so this matches the websocket messages.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the room's own serialized state.
      return JSON.parse(
        await getWorkspaceRoom(context.workspace.id).getState(context.workspace.id)
      );
    }),

  /// One page of the activity log, newest first; pass the previous page's `nextCursor` for older
  /// entries. (The room state only carries the most recent ones.)
  activityLog: procedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        cursor: z.object({createdAt: z.number(), id: z.string()}).nullish(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const entries = await getActivityLogEntries(context.workspace.id, {
        before: input.cursor ?? undefined,
        limit: ACTIVITY_LOG_PAGE_SIZE,
      });
      const last = entries.at(-1)?.activity_log_entry;
      return {
        entries,
        nextCursor:
          entries.length === ACTIVITY_LOG_PAGE_SIZE && last
            ? {createdAt: last.createdAt.getTime(), id: last.id}
            : null,
      };
    }),

  /// Emails sent to the workspace's contact address (src/server/inbound-email.ts).
  emails: {
    /// Newest first, a page at a time: who sent each, its subject and the start of its text.
    list: procedure
      .input(
        z.object({
          workspaceSlug: z.string(),
          cursor: z.object({receivedAt: z.number(), id: z.string()}).nullish(),
        })
      )
      .use(preauthorize)
      .handler(async ({context, input}) => {
        const e = schema.workspaceEmail;
        const emails = await db
          .select({
            id: e.id,
            receivedAt: e.receivedAt,
            fromAddress: e.fromAddress,
            fromName: e.fromName,
            subject: e.subject,
            preview: sql<string | null>`substr(${e.text}, 1, 300)`,
            hasAttachments: sql<boolean>`json_array_length(${e.attachments}) > 0`.mapWith(Boolean),
          })
          .from(e)
          .where(
            and(
              eq(e.workspaceId, context.workspace.id),
              input.cursor
                ? sql`(${e.receivedAt}, ${e.id}) < (${input.cursor.receivedAt}, ${input.cursor.id})`
                : undefined
            )
          )
          .orderBy(sql`${e.receivedAt} desc`, sql`${e.id} desc`)
          .limit(EMAILS_PAGE_SIZE);
        const last = emails.at(-1);
        return {
          emails,
          nextCursor:
            emails.length === EMAILS_PAGE_SIZE && last
              ? {receivedAt: last.receivedAt.getTime(), id: last.id}
              : null,
        };
      }),
    /// One email in full.
    get: procedure
      .input(z.object({workspaceSlug: z.string(), id: z.string()}))
      .use(preauthorize)
      .handler(async ({context, input}) => {
        const e = schema.workspaceEmail;
        const email = await db
          .select({
            id: e.id,
            receivedAt: e.receivedAt,
            fromAddress: e.fromAddress,
            fromName: e.fromName,
            subject: e.subject,
            text: e.text,
            html: e.html,
            attachments: e.attachments,
          })
          .from(e)
          .where(and(eq(e.id, input.id), eq(e.workspaceId, context.workspace.id)))
          .get();
        if (!email) throw new ORPCError("NOT_FOUND");
        return email;
      }),
  },

  /// When each puzzle was (most recently) marked solved, from the activity log, for the solves
  /// chart. Clients keep only puzzles that are still solved, so un-solves drop out.
  solves: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      const lastSolvedAt = max(schema.activityLogEntry.createdAt);
      const rows = await db
        .select({puzzleId: schema.puzzleActivityLogEntry.puzzleId, solvedAt: lastSolvedAt})
        .from(schema.puzzleActivityLogEntry)
        .innerJoin(
          schema.activityLogEntry,
          eq(schema.activityLogEntry.id, schema.puzzleActivityLogEntry.activityLogEntryId)
        )
        .where(
          and(
            eq(schema.activityLogEntry.workspaceId, context.workspace.id),
            eq(schema.puzzleActivityLogEntry.subType, "updateStatus"),
            inArray(schema.puzzleActivityLogEntry.field, ["solved", "backsolved"]),
            isNotNull(schema.puzzleActivityLogEntry.puzzleId)
          )
        )
        .groupBy(schema.puzzleActivityLogEntry.puzzleId);
      return rows.flatMap(({puzzleId, solvedAt}) =>
        puzzleId && solvedAt ? [{puzzleId, solvedAt: solvedAt.getTime()}] : []
      );
    }),

  /// Everything the hunt recap needs: who created, solved and answered which puzzle, and when
  /// (compact; the stats are computed in the browser, in the viewer's time zone).
  recap: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      // Every open tab refetches this every couple of minutes, and the answer is the same for
      // everyone in the workspace, so it's computed at most once a minute per workspace (per
      // Cloudflare location). Membership was checked above, before the cache is read.
      const cache = hasDefaultCache(caches) ? caches.default : undefined;
      const cacheKey = new Request(`https://recap.internal/${context.workspace.id}`);
      const cached = await cache?.match(cacheKey);
      if (cached) {
        const recap: Recap = await cached.json();
        return recap;
      }
      const recap = await computeRecap(context.workspace.id);
      if (cache) {
        waitUntil(
          cache.put(
            cacheKey,
            new Response(JSON.stringify(recap), {
              headers: {"cache-control": `max-age=${RECAP_CACHE_SECONDS}`},
            })
          )
        );
      }
      return recap;
    }),

  getDiscordInfo: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context: {workspace}}) => {
      if (!process.env.DISCORD_BOT_TOKEN) return null;
      if (!workspace.discordGuildId) return null;
      const guild = await fetch(`https://discord.com/api/v10/guilds/${workspace.discordGuildId}`, {
        method: "GET",
        headers: {authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`},
      });
      if (guild.status !== 200) {
        const responseText = await guild.text();
        let error: string;
        try {
          const responseJson = JSON.parse(responseText);
          const responseJsonParsed = z
            .object({code: z.number(), message: z.string()})
            .parse(responseJson);
          error = `${responseJsonParsed.code}: ${responseJsonParsed.message}`;
        } catch {
          error = responseText;
        }
        return {ok: false, error} as const;
      }
      return {
        ok: true,
        data: z.object({id: z.string(), name: z.string()}).parse(await guild.json()),
      } as const;
    }),

  /// The team's custom reaction emoji (images in R2, added by anyone in the workspace).
  customEmoji: {
    add: procedure
      .input(
        z.object({
          workspaceSlug: z.string(),
          name: z.string().regex(/^[a-z0-9_-]{1,32}$/),
          fileId: z.string().regex(/^[0-9a-f]{64}$/),
        })
      )
      .use(preauthorize)
      .handler(async ({context, input}) => {
        const theme = parseTheme(context.workspace.theme);
        const others = (theme.customEmoji ?? []).filter(e => e.name !== input.name);
        if (others.length >= 100) {
          throw new ORPCError("BAD_REQUEST", {message: "A team can have up to 100 emoji."});
        }
        // Replaces any emoji of that name, and adds this one at the end.
        await db
          .update(schema.organization)
          .set({
            theme: sql`json_set(${themeJson}, '$.customEmoji', (
              select json_group_array(json(value)) from (
                select value from json_each(${themeJson}, '$.customEmoji')
                where json_extract(value, '$.name') != ${input.name}
                union all
                select json_object('name', ${input.name}, 'fileId', ${input.fileId})
              )
            ))`,
          })
          .where(eq(schema.organization.id, context.workspace.id));
        await invalidateWorkspace(context.workspace.id);
      }),
    remove: procedure
      .input(z.object({workspaceSlug: z.string(), name: z.string()}))
      .use(preauthorize)
      .handler(async ({context, input}) => {
        await db
          .update(schema.organization)
          .set({
            theme: sql`json_set(${themeJson}, '$.customEmoji', (
              select json_group_array(json(value)) from json_each(${themeJson}, '$.customEmoji')
              where json_extract(value, '$.name') != ${input.name}
            ))`,
          })
          .where(eq(schema.organization.id, context.workspace.id));
        await invalidateWorkspace(context.workspace.id);
      }),
  },

  /**
   * Inviting people by email, with better-auth's organization invitations: owners send them from
   * Settings › Members; the emailed link (/workspaces/invite/<id>) works for the invited address.
   */
  invitations: {
    /** Pending invitations (not yet accepted, cancelled or expired). */
    list: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context}) => {
        const rows = await db
          .select({
            id: schema.invitation.id,
            email: schema.invitation.email,
            createdAt: schema.invitation.createdAt,
            expiresAt: schema.invitation.expiresAt,
            inviterName: schema.user.name,
          })
          .from(schema.invitation)
          .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
          .where(
            and(
              eq(schema.invitation.organizationId, context.workspace.id),
              eq(schema.invitation.status, "pending")
            )
          );
        const now = Date.now();
        return rows
          .filter(row => row.expiresAt.getTime() > now)
          .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }),

    /** Emails an invitation to each address; says, per address, whether it went. */
    send: procedure
      .input(z.object({workspaceSlug: z.string(), emails: z.array(z.email()).min(1).max(50)}))
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context, input}) => {
        const emails = [...new Set(input.emails.map(email => email.trim().toLowerCase()))];
        const results: {email: string; ok: boolean; message?: string}[] = [];
        // One at a time: the plugin checks the pending-invitation limit as it goes.
        for (const email of emails) {
          try {
            // oxlint-disable-next-line no-await-in-loop -- sequential on purpose (see above).
            await auth.api.createInvitation({
              headers: context.headers,
              body: {email, role: "member", organizationId: context.workspace.id},
            });
            results.push({email, ok: true});
          } catch (error) {
            const message = authErrorMessage(error);
            results.push({
              email,
              ok: false,
              // The plugin's wording, made friendlier for the two common cases.
              message: /already invited/i.test(message)
                ? "Already invited (resend it from the list below)."
                : /already a member/i.test(message)
                  ? "Already on the team."
                  : message,
            });
          }
        }
        return results;
      }),

    /** Sends a pending invitation's email again (and gives it a fresh expiry). */
    resend: procedure
      .input(z.object({workspaceSlug: z.string(), invitationId: z.string()}))
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context, input}) => {
        const invitation = await db
          .select({email: schema.invitation.email})
          .from(schema.invitation)
          .where(
            and(
              eq(schema.invitation.id, input.invitationId),
              eq(schema.invitation.organizationId, context.workspace.id),
              eq(schema.invitation.status, "pending")
            )
          )
          .get();
        if (!invitation) throw new ORPCError("NOT_FOUND");
        try {
          await auth.api.createInvitation({
            headers: context.headers,
            body: {
              email: invitation.email,
              role: "member",
              organizationId: context.workspace.id,
              resend: true,
            },
          });
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", {message: authErrorMessage(error)});
        }
      }),

    cancel: procedure
      .input(z.object({workspaceSlug: z.string(), invitationId: z.string()}))
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context, input}) => {
        const invitation = await db
          .select({id: schema.invitation.id})
          .from(schema.invitation)
          .where(
            and(
              eq(schema.invitation.id, input.invitationId),
              eq(schema.invitation.organizationId, context.workspace.id)
            )
          )
          .get();
        if (!invitation) throw new ORPCError("NOT_FOUND");
        try {
          await auth.api.cancelInvitation({
            headers: context.headers,
            body: {invitationId: input.invitationId},
          });
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", {message: authErrorMessage(error)});
        }
      }),

    /**
     * What the invitation page shows: whose team, who invited you, and whether you can accept it
     * (signed in with the invited address, still pending). Anyone with the link can see this much;
     * the address is masked unless it's yours.
     */
    preview: procedure
      .input(z.object({invitationId: z.string()}))
      .handler(async ({context, input}) => {
        const row = await db
          .select({
            email: schema.invitation.email,
            status: schema.invitation.status,
            expiresAt: schema.invitation.expiresAt,
            organizationId: schema.invitation.organizationId,
            slug: schema.organization.slug,
            teamName: schema.organization.teamName,
            eventName: schema.organization.eventName,
            inviterName: schema.user.name,
          })
          .from(schema.invitation)
          .innerJoin(
            schema.organization,
            eq(schema.invitation.organizationId, schema.organization.id)
          )
          .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
          .where(eq(schema.invitation.id, input.invitationId))
          .get();
        if (!row) throw new ORPCError("NOT_FOUND");
        const member = await db
          .select({id: schema.member.id})
          .from(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, row.organizationId),
              eq(schema.member.userId, context.session.user.id)
            )
          )
          .get();
        const forYou = row.email.toLowerCase() === context.session.user.email.toLowerCase();
        const status =
          row.status === "pending" && row.expiresAt.getTime() < Date.now()
            ? "expired"
            : row.status === "pending" || row.status === "accepted"
              ? row.status
              : "canceled";
        return {
          slug: row.slug,
          teamName: row.teamName,
          eventName: row.eventName,
          inviterName: row.inviterName,
          email: forYou ? row.email : maskEmail(row.email),
          signedInAs: context.session.user.email,
          forYou,
          isMember: Boolean(member),
          status,
        } as const;
      }),

    /** Accepts an invitation: you join the workspace as a member. */
    accept: procedure
      .input(z.object({invitationId: z.string()}))
      .handler(async ({context, input}) => {
        const workspace = await db
          .select({
            id: schema.organization.id,
            slug: schema.organization.slug,
            googleFolderId: schema.organization.googleFolderId,
            archivedAt: schema.organization.archivedAt,
          })
          .from(schema.invitation)
          .innerJoin(
            schema.organization,
            eq(schema.invitation.organizationId, schema.organization.id)
          )
          .where(eq(schema.invitation.id, input.invitationId))
          .get();
        if (!workspace) throw new ORPCError("NOT_FOUND");
        if (workspace.archivedAt) {
          throw new ORPCError("CONFLICT", {message: ARCHIVED_JOIN_MESSAGE});
        }
        try {
          await auth.api.acceptInvitation({
            headers: context.headers,
            body: {invitationId: input.invitationId},
          });
        } catch (error) {
          // Accepted already (a double click, or another tab): just go to the workspace.
          if (await isMember(workspace.id, context.session.user.id)) return {slug: workspace.slug};
          throw new ORPCError("BAD_REQUEST", {message: authErrorMessage(error)});
        }
        await welcomeNewMember(context, workspace, "invitation");
        return {slug: workspace.slug};
      }),
  },

  members: {
    list: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .handler(async ({context}) => {
        const members = await db
          .select({
            role: schema.member.role,
            user: {
              id: schema.user.id,
              name: schema.user.name,
              email: schema.user.email,
              image: schema.user.image,
            },
          })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
          .where(eq(schema.member.organizationId, context.workspace.id));
        return {
          members: members.map(({role, user}) => ({role: toWorkspaceRole(role), user})),
          myRole: context.role,
        };
      }),

    /// Owners can remove someone from the workspace (not themselves: that's Leave). They can join
    /// again with the password, so changing it may be wise.
    remove: procedure
      .input(z.object({workspaceSlug: z.string(), userId: z.string()}))
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context, input}) => {
        if (input.userId === context.session.user.id) {
          throw new ORPCError("BAD_REQUEST", {
            message: "To remove yourself, leave the workspace instead.",
          });
        }
        const removed = await db
          .delete(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, context.workspace.id),
              eq(schema.member.userId, input.userId)
            )
          )
          .returning({id: schema.member.id});
        if (removed.length === 0) throw new ORPCError("NOT_FOUND");
        await invalidateWorkspace(context.workspace.id);
        // Their access to the team's Drive folder goes too (it was shared when they joined), in
        // the background, retried; the owners hear if it can't be done.
        if (!context.workspace.googleFolderId) return {drive: "none"} as const;
        const user = await db
          .select({name: schema.user.name, email: schema.user.email})
          .from(schema.user)
          .where(eq(schema.user.id, input.userId))
          .get();
        if (!user) return {drive: "none"} as const;
        waitUntil(
          startDriveAccess([{workspaceId: context.workspace.id, userId: input.userId, ...user}])
        );
        return {drive: "removing"} as const;
      }),

    /// Owners can make others owners (or members again). The last owner can't be demoted, so a
    /// workspace always has someone who can manage it.
    updateRole: procedure
      .input(
        z.object({workspaceSlug: z.string(), userId: z.string(), role: z.enum(["owner", "member"])})
      )
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context, input}) => {
        // The check that another owner remains is part of the update, so two owners demoting each
        // other at the same moment can't leave the workspace with no owner.
        const updated = await db
          .update(schema.member)
          .set({role: input.role})
          .where(
            and(
              eq(schema.member.organizationId, context.workspace.id),
              eq(schema.member.userId, input.userId),
              input.role === "member" ? anotherOwner(context.workspace.id, input.userId) : undefined
            )
          )
          .returning({id: schema.member.id});
        if (updated.length > 0) return;
        const isMember = await db
          .select({id: schema.member.id})
          .from(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, context.workspace.id),
              eq(schema.member.userId, input.userId)
            )
          )
          .get();
        if (!isMember) throw new ORPCError("NOT_FOUND");
        throw new ORPCError("BAD_REQUEST", {
          message: "A workspace needs at least one owner. Make someone else an owner first.",
        });
      }),

    get: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .handler(async ({context}) => {
        const member = await db
          .select()
          .from(schema.member)
          .where(
            and(
              eq(schema.member.organizationId, context.workspace.id),
              eq(schema.member.userId, context.session.user.id)
            )
          )
          .get();
        if (!member) {
          throw new ORPCError("NOT_FOUND");
        }
        return member;
      }),
    set: procedure
      .input(
        z.object({workspaceSlug: z.string(), favoritePuzzleIds: z.array(z.string()).max(1000)})
      )
      .use(preauthorize)
      .handler(async ({context, input}) => {
        await db
          .update(schema.member)
          .set({favoritePuzzleIds: [...new Set(input.favoritePuzzleIds)]})
          .where(
            and(
              eq(schema.member.organizationId, context.workspace.id),
              eq(schema.member.userId, context.session.user.id)
            )
          );
      }),
    /** Saves where the member is in the onboarding tour (or that they finished or closed it). */
    setTour: procedure
      .input(z.object({workspaceSlug: z.string(), tour: tourStateSchema}))
      .use(preauthorize)
      .handler(async ({context, input}) => {
        await db
          .update(schema.member)
          .set({tour: input.tour})
          .where(
            and(
              eq(schema.member.organizationId, context.workspace.id),
              eq(schema.member.userId, context.session.user.id)
            )
          );
      }),
  },
  announce: procedure
    .input(
      z.object({workspaceSlug: z.string(), message: z.string(), channelId: z.string().nullable()})
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      await context.notification.broadcast(context.workspace.id, {
        type: "announcement",
        message: input.message,
        from: context.session.user.name,
      });
      if (
        process.env.DISCORD_BOT_TOKEN &&
        context.workspace.discordGuildId &&
        context.workspace.voiceTool === "discord" &&
        input.channelId
      ) {
        const channel: {guild_id?: string} = await (
          await fetchDiscord(`/channels/${input.channelId}`)
        ).json();
        if (channel.guild_id !== context.workspace.discordGuildId) throw new ORPCError("NOT_FOUND");
        const formData = new FormData();
        formData.append(
          "content",
          `**Announcement from ${context.session.user.name}**\n${input.message}`
        );
        await fetchDiscord(`/channels/${input.channelId}/messages`, {
          method: "POST",
          body: formData,
        });
      }
    }),
  discord: {
    listTextChannels: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .handler(async ({context}) => {
        if (!process.env.DISCORD_BOT_TOKEN || !context.workspace.discordGuildId) return null;
        const data: {id: string; type: number; name?: string}[] = await (
          await fetchDiscord(`/guilds/${context.workspace.discordGuildId}/channels`)
        ).json();
        return data.filter(c => c.type === 0);
      }),
    disconnect: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .use(requireOwner)
      .handler(async ({context}) => {
        const guildId = context.workspace.discordGuildId;
        if (!guildId) throw new ORPCError("BAD_REQUEST");
        // Unlinked now; WOW's channels are deleted in the background, a retried step each, since
        // Discord's rate limits make that slow on a big server.
        await db
          .update(schema.organization)
          .set({discordGuildId: null})
          .where(eq(schema.organization.id, context.workspace.id));
        await invalidateWorkspace(context.workspace.id);
        await env.DISCORD_DISCONNECT_WORKFLOW.create({params: {guildId}});
      }),
  },
};

/**
 * Everything that happens when someone joins a workspace (with the password, or by accepting an
 * emailed invitation): the solver tour, the Drive folder shared with them, the activity log entry,
 * and everyone's board updated.
 */
async function welcomeNewMember(
  context: AuthedContext,
  workspace: {id: string; googleFolderId: string | null},
  via: "password" | "invitation"
) {
  // New members get the shorter solver tour the first time they open the workspace.
  await db
    .update(schema.member)
    .set({tour: newTourState("solver")})
    .where(
      and(
        eq(schema.member.organizationId, workspace.id),
        eq(schema.member.userId, context.session.user.id)
      )
    );

  // The team's Drive folder (every puzzle sheet) is shared with them in the background, retried;
  // the owners hear if it can't be done.
  if (workspace.googleFolderId) {
    const {id, name, email} = context.session.user;
    waitUntil(startDriveAccess([{workspaceId: workspace.id, userId: id, name, email}]));
  }
  // Awaited before invalidating so the broadcast state includes the "join" entry.
  await context.activityLog.createWorkspace({workspaceId: workspace.id, subType: "join"});
  await invalidateWorkspace(workspace.id);
  trackServerEvent("workspace_joined", {
    distinctId: context.session.user.id,
    workspaceId: workspace.id,
    properties: {via},
  });
}

/** A better-auth error's message, for showing to the person (it's written for that). */
const authErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Something went wrong.";

/** "a•••@example.com": enough to recognise your own address, not to read someone else's. */
const maskEmail = (email: string) => {
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 1)}•••@${domain}`;
};

/** How long a workspace's recap is cached (it backs the awards and the leaderboard). */
const RECAP_CACHE_SECONDS = 60;

function hasDefaultCache(c: CacheStorage): c is CacheStorage & {default: Cache} {
  return "default" in c;
}

type Recap = Awaited<ReturnType<typeof computeRecap>>;

/** Everything the hunt recap needs, for one workspace. */
async function computeRecap(workspaceId: string) {
  const rows = await db
    .select({
      at: schema.activityLogEntry.createdAt,

      userId: schema.activityLogEntry.userId,
      subType: schema.puzzleActivityLogEntry.subType,
      puzzleId: schema.puzzleActivityLogEntry.puzzleId,
      puzzleName: schema.puzzleActivityLogEntry.puzzleName,
      field: schema.puzzleActivityLogEntry.field,
    })
    .from(schema.puzzleActivityLogEntry)
    .innerJoin(
      schema.activityLogEntry,
      eq(schema.activityLogEntry.id, schema.puzzleActivityLogEntry.activityLogEntryId)
    )
    .where(
      and(
        eq(schema.activityLogEntry.workspaceId, workspaceId),
        inArray(schema.puzzleActivityLogEntry.subType, [
          "create",
          "updateStatus",
          "updateAnswer",
          "updateImportance",
        ])
      )
    )
    .orderBy(schema.activityLogEntry.createdAt);
  const [roundsCreated, activeTime, contributions] = await Promise.all([
    // Rounds added, per person (keeping the board up to date).
    db
      .select({userId: schema.activityLogEntry.userId, count: count()})
      .from(schema.roundActivityLogEntry)
      .innerJoin(
        schema.activityLogEntry,
        eq(schema.activityLogEntry.id, schema.roundActivityLogEntry.activityLogEntryId)
      )
      .where(
        and(
          eq(schema.activityLogEntry.workspaceId, workspaceId),
          eq(schema.roundActivityLogEntry.subType, "create")
        )
      )
      .groupBy(schema.activityLogEntry.userId),
    // Active time on puzzles, per person and hour of day where they were.
    db
      .select({
        userId: schema.puzzleTime.userId,
        localHour: schema.puzzleTime.localHour,
        seconds: sql<number>`cast(sum(${schema.puzzleTime.seconds}) as integer)`,
      })
      .from(schema.puzzleTime)
      .where(eq(schema.puzzleTime.workspaceId, workspaceId))
      .groupBy(schema.puzzleTime.userId, schema.puzzleTime.localHour),
    // Who says they helped solve what.
    db
      .select({
        puzzleId: schema.puzzleContributor.puzzleId,
        userId: schema.puzzleContributor.userId,
      })
      .from(schema.puzzleContributor)
      .innerJoin(schema.puzzle, eq(schema.puzzle.id, schema.puzzleContributor.puzzleId))
      .innerJoin(schema.round, eq(schema.round.id, schema.puzzle.roundId))
      .where(eq(schema.round.workspaceId, workspaceId)),
  ]);
  const userIds = [
    ...new Set([
      ...rows.map(row => row.userId),
      ...roundsCreated.map(row => row.userId),
      ...activeTime.map(row => row.userId),
      ...contributions.map(row => row.userId),
    ]),
  ];
  // D1 allows only 100 bound parameters per query, and a big team has more people than that.
  const users = (
    await Promise.all(
      chunks(userIds, 90).map(batch =>
        db
          .select({
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image,
          })
          .from(schema.user)
          .where(inArray(schema.user.id, batch))
      )
    )
  ).flat();
  return {
    users,
    events: rows.map(row => ({
      at: row.at.getTime(),
      userId: row.userId,
      type: row.subType,
      puzzleId: row.puzzleId,
      puzzleName: row.puzzleName,
      field: row.field,
    })),
    roundsCreated,
    activeTime,
    contributions,
  };
}
