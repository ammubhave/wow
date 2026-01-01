import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {betterAuth} from "better-auth/minimal";
import {username} from "better-auth/plugins";
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
  experimental: {joins: true},
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({user, url}) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const username =
        "username" in user && typeof user.username === "string" ? user.username : "UNKNOWN";
      waitUntil(
        resend.emails.send({
          from: "noreply@wafflehaus.io",
          to: user.email,
          subject: "Change password for Wafflehaüs Organized Workspace (WOW)",
          html: `<h1>Reset password</h1><p>Username: ${username}</p><p>A password reset was requested for your account. If it wasn't you, you can ignore this email. Click <a href='${url}'>here</a> to reset your password.</p>`,
        })
      );
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({user, url}) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      waitUntil(
        resend.emails.send({
          from: "noreply@wafflehaus.io",
          to: user.email,
          subject: "Verify your email for Wafflehaüs Organized Workspace (WOW)",
          html: `<h1>Verify your email</h1><p>Click <a href='${url}'>here</a> to verify your email address.</p>`,
        })
      );
    },
  },
  user: {
    additionalFields: {notificationsDisabled: {type: "boolean", defaultValue: false}},
    changeEmail: {enabled: true},
  },
  trustedOrigins: ["https://www.wafflehaus.io", "http://localhost:3000"],
  plugins: [
    ...(process.env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: process.env.TURNSTILE_SECRET_KEY,
            endpoints: [
              "/sign-in/username",
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
        afterCreateOrganization: async ({organization}) => {
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
            .where(eq(schema.organization.id, organization.id));
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
            googleAccessToken: {type: "string", required: false},
            googleRefreshToken: {type: "string", required: false},
            googleTokenExpiresAt: {type: "date", required: false},
            googleFolderId: {type: "string", required: false},
            googleTemplateFileId: {type: "string", required: false},
            discordGuildId: {type: "string", required: false},
            tags: {type: "string[]", required: false},
            links: {type: "json", required: false},
          },
        },
      },
    }),
    username({
      minUsernameLength: 3,
      displayUsernameValidator: displayUsername => displayUsername.length >= 3,
    }),
    tanstackStartCookies(),
  ],
  session: {cookieCache: {enabled: true, maxAge: 5 * 60}},
});
