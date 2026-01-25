import {ORPCError} from "@orpc/server";
import {env, waitUntil} from "cloudflare:workers";
import {and, desc, eq} from "drizzle-orm";
import {z} from "zod";

import {auth} from "@/lib/auth";
import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";

import {fetchDiscord} from "../do/discord-client";
import {getWorkspaceRoom} from "../do/workspace";
import {preauthorize, procedure} from "./base";

export const workspacesRouter = {
  list: procedure.handler(async ({context}) => {
    const workspaces = await auth.api.listOrganizations({headers: context.headers});
    return workspaces.map(({googleAccessToken, googleFolderId, ...workspace}) => ({
      ...workspace,
      isOnboarding: googleAccessToken === null || googleFolderId === null,
    }));
  }),

  get: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      const workspace = await db
        .select()
        .from(schema.organization)
        .where(eq(schema.organization.id, context.workspace.id))
        .get();
      if (!workspace) throw new ORPCError("NOT_FOUND");
      let googleAccessToken = null;
      try {
        googleAccessToken = await context.google.getAccessToken(context.workspace.id);
      } catch (e) {
        console.error(e);
      }

      const rounds = await db.query.round.findMany({
        where: (t, {eq}) => eq(t.workspaceId, workspace.id),
        with: {puzzles: {with: {childPuzzles: true}}},
      });

      return {
        ...workspace,
        rounds: rounds.map(round => ({
          ...round,
          unassignedPuzzles: round.puzzles.filter(
            puzzle => !puzzle.isMetaPuzzle && puzzle.parentPuzzleId === null
          ),
          metaPuzzles: round.puzzles.filter(puzzle => puzzle.isMetaPuzzle),
        })),
        isOnboarding: googleAccessToken === null || workspace.googleFolderId === null,
      };
    }),

  getPublic: procedure.input(z.string()).handler(async ({input}) => {
    const workspace = await db
      .select({teamName: schema.organization.teamName, eventName: schema.organization.eventName})
      .from(schema.organization)
      .where(eq(schema.organization.slug, input))
      .get();
    if (!workspace) throw new ORPCError("NOT_FOUND");
    return workspace;
  }),
  join: procedure
    .input(z.object({workspaceSlug: z.string(), password: z.string()}))
    .handler(async ({context, input}) => {
      const workspace = await db
        .select()
        .from(schema.organization)
        .where(
          and(
            eq(schema.organization.slug, input.workspaceSlug),
            eq(schema.organization.password, input.password)
          )
        )
        .get();
      if (!workspace) {
        throw new ORPCError("FORBIDDEN");
      }
      await auth.api.addMember({
        body: {userId: context.session.user.id, role: "admin", organizationId: workspace.id},
      });

      const googleAccessToken = await context.google.getAccessToken(workspace.id);
      waitUntil(
        Promise.all([
          (async () => {
            const resp = await fetch(
              `https://www.googleapis.com/drive/v3/files/${workspace.googleFolderId}/permissions?sendNotificationEmail=false`,
              {
                method: "POST",
                headers: {Authorization: `Bearer ${googleAccessToken}`},
                body: JSON.stringify({
                  type: "user",
                  emailAddress: context.session.user.email,
                  role: "writer",
                }),
              }
            );
            if (!resp.ok) {
              throw new Error(
                `Failed to share folder ${workspace.googleFolderId} for user ${context.session.user.email}: ${resp.status}: ${resp.statusText}: ${await resp.text()}`
              );
            }
          })(),
          context.activityLog.createWorkspace({workspaceId: workspace.id, subType: "join"}),
        ])
      );
      await (await getWorkspaceRoom(workspace.id)).invalidate();
      return workspace;
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
        links: z.array(z.object({name: z.string(), url: z.url()})).optional(),
      })
    )
    .use(preauthorize)
    .handler(async ({context, input}) => {
      let commentUpdatedAt = undefined;
      let commentUpdatedBy = undefined;
      if (input.comment !== undefined) {
        commentUpdatedAt = new Date();
        commentUpdatedBy = context.session.user.displayUsername;
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
        })
        .where(eq(schema.organization.id, context.workspace.id))
        .returning();
      if (!workspace) throw new ORPCError("NOT_FOUND");
      await (await getWorkspaceRoom(workspace.id)).invalidate();
    }),

  delete: procedure.input(z.string()).handler(async () => {
    throw new Error(
      "Workspace deletion has been disabled. Contact support to delete your workspace."
    );
  }),

  leave: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context}) => {
      await auth.api.leaveOrganization({
        headers: context.headers,
        body: {organizationId: context.workspace.id},
      });
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
    .handler(async ({context, input}) => {
      await db
        .update(schema.organization)
        .set({googleFolderId: input.folderId})
        .where(eq(schema.organization.id, context.workspace.id));
      await (await getWorkspaceRoom(context.workspace.id)).invalidate();
    }),

  setGoogleTemplateFileId: procedure
    .input(z.object({workspaceSlug: z.string(), fileId: z.string()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      await db
        .update(schema.organization)
        .set({googleTemplateFileId: input.fileId})
        .where(eq(schema.organization.id, context.workspace.id));
      await (await getWorkspaceRoom(context.workspace.id)).invalidate();
    }),

  shareGoogleDriveFolder: procedure
    .input(z.object({workspaceSlug: z.string(), email: z.email()}))
    .use(preauthorize)
    .handler(async ({context, input}) => {
      const workspace = await db.query.organization.findFirst({
        where: (t, {eq}) => eq(t.slug, input.workspaceSlug),
      });
      if (!workspace) throw new ORPCError("NOT_FOUND");
      const googleAccessToken = await context.google.getAccessToken(context.workspace.id);
      if (!workspace.googleFolderId || !googleAccessToken) {
        throw new ORPCError("FORBIDDEN", {
          message: "Google drive connection is not correctly configured.",
        });
      }
      const {id: permissionId} = z
        .object({kind: z.literal("drive#permissionId"), id: z.string()})
        .parse(
          await (
            await fetch(`https://www.googleapis.com/drive/v2/permissionIds/${input.email}`, {
              method: "GET",
              headers: {Authorization: `Bearer ${googleAccessToken}`},
            })
          ).json()
        );
      await fetch(
        `https://www.googleapis.com/drive/v2/files/${workspace.googleFolderId}/permissions?${new URLSearchParams(
          {sendNotificationEmails: "false"}
        ).toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({id: permissionId, role: "writer", type: "user"}),
        }
      );
    }),

  getDiscordInfo: procedure
    .input(z.object({workspaceSlug: z.string()}))
    .use(preauthorize)
    .handler(async ({context: {workspace}}) => {
      if (!workspace.discordGuildId) {
        return null;
      }
      const guild = await fetch(`https://discord.com/api/v10/guilds/${workspace.discordGuildId}`, {
        method: "GET",
        headers: {authorization: `Bot ${env.DISCORD_BOT_TOKEN}`},
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

  activityLog: {
    get: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .handler(async ({context}) => {
        const activityLogEntries = await db
          .select()
          .from(schema.activityLogEntry)
          .leftJoin(schema.user, eq(schema.activityLogEntry.userId, schema.user.id))
          .leftJoin(
            schema.roundActivityLogEntry,
            eq(schema.activityLogEntry.id, schema.roundActivityLogEntry.activityLogEntryId)
          )
          .leftJoin(
            schema.puzzleActivityLogEntry,
            eq(schema.activityLogEntry.id, schema.puzzleActivityLogEntry.activityLogEntryId)
          )
          .leftJoin(
            schema.workspaceActivityLogEntry,
            eq(schema.activityLogEntry.id, schema.workspaceActivityLogEntry.activityLogEntryId)
          )
          .where(eq(schema.activityLogEntry.workspaceId, context.workspace.id))
          .orderBy(desc(schema.activityLogEntry.createdAt));

        return activityLogEntries;
      }),
  },
  members: {
    list: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .handler(async ({context}) => {
        const members = await db
          .select({
            user: {
              id: schema.user.id,
              name: schema.user.name,
              email: schema.user.email,
              image: schema.user.image,
              displayUsername: schema.user.displayUsername,
            },
          })
          .from(schema.member)
          .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
          .where(eq(schema.member.organizationId, context.workspace.id));
        return members;
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
      .input(z.object({workspaceSlug: z.string(), favoritePuzzleIds: z.array(z.string())}))
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
      });
      if (context.workspace.discordGuildId && input.channelId) {
        const channel: {guild_id?: string} = await (
          await fetchDiscord(`/channels/${input.channelId}`)
        ).json();
        if (channel.guild_id !== context.workspace.discordGuildId) throw new ORPCError("NOT_FOUND");
        const formData = new FormData();
        formData.append("content", input.message);
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
        if (!context.workspace.discordGuildId) return null;
        const data: {id: string; type: number; name?: string}[] = await (
          await fetchDiscord(`/guilds/${context.workspace.discordGuildId}/channels`)
        ).json();
        return data.filter(c => c.type === 0);
      }),
    disconnect: procedure
      .input(z.object({workspaceSlug: z.string()}))
      .use(preauthorize)
      .handler(async ({context}) => {
        if (!context.workspace.discordGuildId) throw new ORPCError("BAD_REQUEST");
        await env.DISCORD_CLIENT.getByName(context.workspace.discordGuildId).deleteAllChannels(
          context.workspace.discordGuildId
        );
        await db
          .update(schema.organization)
          .set({discordGuildId: null})
          .where(eq(schema.organization.id, context.workspace.id));
        await (await getWorkspaceRoom(context.workspace.id)).invalidate();
      }),
  },
};
