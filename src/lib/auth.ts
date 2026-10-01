import {drizzleAdapter} from "@better-auth/drizzle-adapter/relations-v2";
import {betterAuth} from "better-auth/minimal";
import {organization} from "better-auth/plugins";
import {captcha} from "better-auth/plugins";
import {tanstackStartCookies} from "better-auth/tanstack-start";
import {waitUntil} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {Resend} from "resend";

import {db} from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: "sqlite", schema}),
  advanced: {database: {joins: true}},
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({user, url}) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      waitUntil(
        resend.emails.send({
          from: "noreply@wafflehaus.io",
          to: user.email,
          subject: "Change password for Wafflehaüs Organized Workspaces (WOW)",
          html: `<h1>Reset password</h1><p>Email: ${user.email}</p><p>A password reset was requested for your account. If it wasn't you, you can ignore this email. Click <a href='${url}'>here</a> to reset your password.</p>`,
        })
      );
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
    sendVerificationEmail: async ({user, url}) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      waitUntil(
        resend.emails.send({
          from: "noreply@wafflehaus.io",
          to: user.email,
          subject: "Verify your email for Wafflehaüs Organized Workspaces (WOW)",
          html: `<h1>Verify your email</h1><p>Click <a href='${url}'>here</a> to verify your email address.</p>`,
        })
      );
    },
  },
  user: {
    additionalFields: {notificationsDisabled: {type: "boolean", defaultValue: false}},
    changeEmail: {enabled: true},
  },
  // In dev, trust any localhost port so `vp dev --port <n>` works (e.g. for Google sign-in).
  trustedOrigins: [
    "https://www.wafflehaus.io",
    ...(import.meta.env?.DEV ? ["http://localhost:*"] : ["http://localhost:3000"]),
  ],
  plugins: [
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
        afterCreateOrganization: async ({organization: org}) => {
          await db
            .update(schema.organization)
            .set({
              tags: ["crossword", "physical"],
              links: [
                {name: "Nutrimatic", url: "https://nutrimatic.org"},
                {name: "Qat", url: "https://www.quinapalus.com/cgi-bin/qat"},
                {name: "util.in", url: "https://util.in"},
              ],
            })
            .where(eq(schema.organization.id, org.id));
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
            googleFolderId: {type: "string", required: false},
            googleTemplateFileId: {type: "string", required: false},
            discordGuildId: {type: "string", required: false},
            tags: {type: "string[]", required: false},
            links: {type: "json", required: false},
          },
        },
        member: {additionalFields: {favoritePuzzleIds: {type: "string[]", required: false}}},
      },
    }),
    tanstackStartCookies(),
  ],
  session: {cookieCache: {enabled: true, maxAge: 5 * 60}},
});
