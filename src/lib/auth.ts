import {drizzleAdapter} from "@better-auth/drizzle-adapter/relations-v2";
import {passkey} from "@better-auth/passkey";
import {betterAuth} from "better-auth/minimal";
import {organization} from "better-auth/plugins";
import {captcha, lastLoginMethod} from "better-auth/plugins";
import {tanstackStartCookies} from "better-auth/tanstack-start";
import {and, eq} from "drizzle-orm";
import {z} from "zod";

import {sendActionEmail} from "../server/email";
import {trackServerEvent} from "../server/posthog";
import {db} from "./db";
import * as schema from "./db/schema";
import {newTourState} from "./tour-state";

// Owns the activity of accounts that have been deleted (see `user.deleteUser` below).
const DELETED_USER_ID = "deleted-user";

/** The links a new workspace was created with: well-formed web links only, a few at most. */
const givenLinks = (links: unknown) =>
  z
    .array(z.object({name: z.string().min(1).max(100), url: z.url({protocol: /^https?$/})}))
    .max(5)
    .catch([])
    .parse(links);

export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: "sqlite", schema}),
  advanced: {database: {joins: true}},
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
      },
    },
  },
  // In dev, trust any localhost port so `vp dev --port <n>` works (e.g. for Google sign-in).
  trustedOrigins: [
    "https://www.wafflehaus.io",
    ...(import.meta.env?.DEV ? ["http://localhost:*"] : ["http://localhost:3000"]),
  ],
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
      organizationHooks: {
        beforeCreateOrganization: async ({organization: org}) => {
          const reservedSlugs = ["exchange"];
          if (reservedSlugs.includes(org.slug?.toLowerCase() ?? "")) {
            throw new Error(`Workspace ID cannot be ${org.slug?.toLowerCase()}.`);
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
    tanstackStartCookies(),
  ],
  session: {cookieCache: {enabled: true, maxAge: 5 * 60}},
});
