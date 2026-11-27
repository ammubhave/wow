import {drizzleAdapter} from "@better-auth/drizzle-adapter/relations-v2";
import {oauthProvider} from "@better-auth/oauth-provider";
import {passkey} from "@better-auth/passkey";
import {APIError} from "better-auth/api";
import {betterAuth} from "better-auth/minimal";
import {organization} from "better-auth/plugins";
import {captcha, jwt, lastLoginMethod} from "better-auth/plugins";
import {tanstackStartCookies} from "better-auth/tanstack-start";
import {and, eq, isNotNull, sql} from "drizzle-orm";
import {z} from "zod";

import {startDriveAccess} from "../server/drive-access";
import {sendActionEmail} from "../server/email";
import {trackServerEvent} from "../server/posthog";
import {authRateLimit} from "./auth-rate-limit";
import {db} from "./db";
import * as schema from "./db/schema";
import {EXTENSION_CLIENT_ID, EXTENSION_ID} from "./extension";
import {newTourState} from "./tour-state";
import {workspaceSlugProblem} from "./workspace-slug";

// Owns the activity of accounts that have been deleted (see `user.deleteUser` below).
const DELETED_USER_ID = "deleted-user";
/** Workspaces with a Drive folder that an account being deleted was in, from before to after. */
const driveFoldersOfDeletedUsers = new Map<string, string[]>();

/** The links a new workspace was created with: well-formed web links only, a few at most. */
const givenLinks = (links: unknown) =>
  z
    .array(z.object({name: z.string().min(1).max(100), url: z.url({protocol: /^https?$/})}))
    .max(5)
    .catch([])
    .parse(links);

/** How long an emailed invitation works. */
export const INVITATION_DAYS = 7;

export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: "sqlite", schema}),
  advanced: {
    database: {joins: true},
    // Set by Cloudflare to the connecting client. The default (X-Forwarded-For) can be sent by the
    // client too, and then rate limiting can't tell anyone apart.
    ipAddress: {ipAddressHeaders: ["cf-connecting-ip"]},
  },
  // Counted by Cloudflare's rate-limiting bindings (see auth-rate-limit.ts).
  rateLimit: authRateLimit,
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({user, url}) => {
      sendActionEmail({
        to: user.email,
        subject: "Reset your WOW password",
        intro: [`Someone asked to reset the password for ${user.email}.`],
        action: {label: "Reset password", url},
        outro: ["If it wasn't you, you can ignore this email: your password stays the same."],
      });
    },
  },
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  emailVerification: {
    // Also used when you change your email: it goes to the new address.
    sendVerificationEmail: async ({user, url}) => {
      sendActionEmail({
        to: user.email,
        subject: "Verify your email for WOW",
        intro: [`Confirm that ${user.email} is your email address for WOW.`],
        action: {label: "Verify email", url},
        outro: [
          "If you didn't sign up for WOW (or change your email to this one), ignore this email.",
        ],
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async user => {
          trackServerEvent("user_signed_up", {distinctId: user.id});
        },
      },
    },
  },
  user: {
    additionalFields: {notificationsDisabled: {type: "boolean", defaultValue: false}},
    changeEmail: {enabled: true},
    deleteUser: {
      enabled: true,
      // Activity entries cascade with their user, which would erase this person from every team's
      // history. Hand them to a shared "Deleted user" first, so the history survives.
      beforeDelete: async user => {
        await db
          .insert(schema.user)
          .values({
            id: DELETED_USER_ID,
            name: "Deleted user",
            email: "deleted-user@wafflehaus.invalid",
          })
          .onConflictDoNothing();
        await db
          .update(schema.activityLogEntry)
          .set({userId: DELETED_USER_ID})
          .where(eq(schema.activityLogEntry.userId, user.id));
        // Noted now (their memberships go with the account), acted on in afterDelete.
        const workspaces = await db
          .select({id: schema.organization.id})
          .from(schema.member)
          .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
          .where(
            and(eq(schema.member.userId, user.id), isNotNull(schema.organization.googleFolderId))
          );
        driveFoldersOfDeletedUsers.set(
          user.id,
          workspaces.map(workspace => workspace.id)
        );
      },
      // Their access to each team's Drive folder is taken away. Started only once the account is
      // gone: the workflow acts on whether they're still a member.
      afterDelete: async user => {
        const workspaceIds = driveFoldersOfDeletedUsers.get(user.id) ?? [];
        driveFoldersOfDeletedUsers.delete(user.id);
        await startDriveAccess(
          workspaceIds.map(workspaceId => ({
            workspaceId,
            userId: user.id,
            name: user.name,
            email: user.email,
          }))
        );
      },
    },
  },
  // In dev, trust any localhost port so `vp dev --port <n>` works (e.g. for Google sign-in).
  trustedOrigins: [
    "https://www.wafflehaus.io",
    ...(import.meta.env?.DEV ? ["http://localhost:*"] : ["http://localhost:3000"]),
    // The Chrome extension, which exchanges and refreshes its OAuth tokens from its own pages.
    `chrome-extension://${EXTENSION_ID}`,
  ],
  // The JWT plugin's own session-token endpoint: unused (the OAuth provider issues the tokens).
  disabledPaths: ["/token"],
  plugins: [
    // Passkeys are bound to the registrable domain, so one works on www.wafflehaus.io and the apex.
    passkey({rpID: import.meta.env?.DEV ? "localhost" : "wafflehaus.io", rpName: "WOW"}),
    // Remembers (in a cookie) how this browser last signed in, so the login page can say so.
    lastLoginMethod(),
    // Captcha is optional: only enforce it when both the secret and the site key the auth pages
    // render with (same `import.meta.env` value as `src/components/captcha.tsx`) are configured.
    ...(process.env.TURNSTILE_SECRET_KEY && import.meta.env?.VITE_PUBLIC_TURNSTILE_SITE_KEY
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY,
            endpoints: [
              "/sign-in/email",
              "/sign-up/email",
              "/forget-password",
              "/request-password-reset",
            ],
          }),
        ]
      : []),
    organization({
      membershipLimit: 500,
      // Inviting by email (Settings › Members). The link only works for the invited address.
      invitationExpiresIn: INVITATION_DAYS * 24 * 60 * 60,
      invitationLimit: 50,
      sendInvitationEmail: async ({id, email, organization: org, inviter}) => {
        // Our extra columns are on the row, just not in the plugin's type.
        const fields: Record<string, unknown> = org;
        const teamName = typeof fields.teamName === "string" ? fields.teamName : "";
        const eventName = typeof fields.eventName === "string" ? fields.eventName : "";
        const team = teamName || org.name;
        sendActionEmail({
          to: email,
          subject: `${inviter.user.name} invited you to ${team} on WOW`,
          intro: [
            `${inviter.user.name} invited you to join ${team}${eventName ? ` for ${eventName}` : ""} on WOW, the team's workspace for the hunt: the puzzles, sheets, chat and calls.`,
          ],
          action: {
            label: "Join the team",
            url: `${process.env.BETTER_AUTH_URL ?? "https://www.wafflehaus.io"}/workspaces/invite/${id}`,
          },
          outro: [
            `Sign in (or sign up) with ${email} to accept. The invitation expires in ${INVITATION_DAYS} days.`,
            "Not expecting this? You can ignore this email.",
          ],
        });
      },
      organizationHooks: {
        // Only owners invite. (Old "admin" members count as members in WOW, but the plugin's own
        // rules would let them.)
        beforeCreateInvitation: async ({invitation, inviter}) => {
          const member = await db
            .select({role: schema.member.role})
            .from(schema.member)
            .where(
              and(
                eq(schema.member.organizationId, invitation.organizationId),
                eq(schema.member.userId, inviter.id)
              )
            )
            .get();
          if (member?.role !== "owner") {
            throw new APIError("FORBIDDEN", {message: "Only owners can invite people."});
          }
          if (invitation.role !== "member") {
            throw new APIError("BAD_REQUEST", {message: "Invite people as members."});
          }
        },
        beforeCreateOrganization: async ({organization: org}) => {
          // Its address is /<slug>: not one of the app's own, and a working URL.
          const slugProblem = workspaceSlugProblem(org.slug ?? "");
          if (slugProblem) throw new APIError("BAD_REQUEST", {message: slugProblem});
          // Email addresses ignore case, so the contact email <slug>@wafflehaus.io needs a slug no
          // other workspace has in any case ("NightOwls" and "nightowls" would share one).
          const sameAddress = await db
            .select({id: schema.organization.id})
            .from(schema.organization)
            .where(sql`lower(${schema.organization.slug}) = ${org.slug?.toLowerCase() ?? ""}`)
            .get();
          if (sameAddress) {
            throw new APIError("BAD_REQUEST", {message: "That ID is taken. Choose another one."});
          }
          // The same rule as changing it later (workspaces.update).
          if (typeof org.password !== "string" || org.password.length < 8) {
            throw new APIError("BAD_REQUEST", {
              message: "The workspace password needs at least 8 characters.",
            });
          }
        },
        afterCreateOrganization: async ({organization: org, user}) => {
          trackServerEvent("workspace_created", {distinctId: user.id, workspaceId: org.id});
          await db
            .update(schema.organization)
            .set({
              tags: ["crossword", "physical"],
              // Links given at creation (the hunt's website, when picked from the hunt list) come
              // first, then the usual solving tools.
              links: [
                ...givenLinks(org.links),
                {name: "Nutrimatic", url: "https://nutrimatic.org"},
                {name: "Qat", url: "https://www.quinapalus.com/cgi-bin/qat"},
                {name: "util.in", url: "https://util.in"},
              ],
            })
            .where(eq(schema.organization.id, org.id));
          // The creator gets the full guided tour the first time they open the workspace.
          await db
            .update(schema.member)
            .set({tour: newTourState("captain")})
            .where(
              and(eq(schema.member.organizationId, org.id), eq(schema.member.userId, user.id))
            );
        },
      },
      schema: {
        organization: {
          additionalFields: {
            teamName: {type: "string"},
            eventName: {type: "string"},
            password: {type: "string"},
            comment: {type: "string", required: false},
            commentUpdatedAt: {type: "date", required: false},
            commentUpdatedBy: {type: "string", required: false},
            // OAuth credentials: server-only. Never returned by the auth API (e.g.
            // `organization.list()`) and not settable through it.
            googleAccessToken: {type: "string", required: false, returned: false, input: false},
            googleRefreshToken: {type: "string", required: false, returned: false, input: false},
            googleTokenExpiresAt: {type: "date", required: false, returned: false, input: false},
            // Point at external resources (a Drive folder, a Discord server): set only by the app
            // after the owner connects them, never by a client through the auth API. A workspace
            // created with someone else's discordGuildId could rewrite that server's channels.
            googleFolderId: {type: "string", required: false, input: false},
            googleTemplateFileId: {type: "string", required: false, input: false},
            discordGuildId: {type: "string", required: false, input: false},
            // Which tools the team chose (see workspace-tools.tsx): "builtin" or "google" sheets,
            // "builtin" or "discord" calls. A choice, kept apart from the connections, so switching
            // back to built-in leaves existing Google Sheets and Discord channels working.
            sheetsTool: {type: "string", required: true, defaultValue: "builtin", input: false},
            voiceTool: {type: "string", required: true, defaultValue: "builtin", input: false},
            // When an owner archived it: hidden from everyone's workspace list (see setArchived).
            archivedAt: {type: "date", required: false, input: false},
            tags: {type: "string[]", required: false},
            links: {type: "json", required: false},
            // Optional hunt clock (the header shows elapsed/remaining time when set).
            huntStartsAt: {type: "date", required: false},
            huntEndsAt: {type: "date", required: false},
            huntLocation: {type: "string", required: false},
            // Look and feel: accent color, emoji, team custom emoji (see workspace-theme.ts).
            theme: {type: "json", required: false},
          },
        },
        member: {
          additionalFields: {
            favoritePuzzleIds: {type: "string[]", required: false},
            tour: {type: "json", required: false, input: false},
          },
        },
      },
    }),
    // Signs the OAuth provider's access tokens (JWTs for API_RESOURCE), verified in-process by
    // src/server/request-session.ts. No JWT header on ordinary session requests.
    jwt({disableSettingJwtHeader: true}),
    // OAuth 2.1 provider, for first-party clients: the Chrome extension (src/lib/extension.ts).
    // A migration registers it, and the API (API_RESOURCE) as the resource its tokens are for,
    // rather than the `resources` option, which seeds at startup: I/O a Worker can't do there.
    // /oauth/login sends someone not signed in to the login page and back; the extension skips
    // the consent page, which is here for any other client.
    oauthProvider({
      loginPage: "/oauth/login",
      consentPage: "/oauth/consent",
      // Clients and resources only come from migrations: nobody registers, edits or lists them
      // through the API (by default any signed-in user could create clients).
      clientPrivileges: () => false,
      resourcePrivileges: () => false,
      cachedTrustedClients: new Set([EXTENSION_CLIENT_ID]),
      // Refresh tokens rotate on every use, and using an old one again revokes them all (theft
      // protection). A refresh whose answer never arrived (the extension's service worker stopped,
      // or the network dropped) would then sign the extension out; within a minute, asking again
      // with the old token gets the same answer instead.
      refreshTokenReuseInterval: 60,
    }),
    tanstackStartCookies(),
  ],
  session: {cookieCache: {enabled: true, maxAge: 5 * 60}},
});
