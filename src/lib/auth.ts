import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {betterAuth} from "better-auth/minimal";
import {haveIBeenPwned, username} from "better-auth/plugins";
import {organization} from "better-auth/plugins";
import {captcha} from "better-auth/plugins";
import {tanstackStartCookies} from "better-auth/tanstack-start";
import {waitUntil} from "cloudflare:workers";
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
  user: {additionalFields: {notificationsDisabled: {type: "boolean", default: false}}},
  trustedOrigins: ["https://www.wafflehaus.io", "http://localhost:3000"],
  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
      endpoints: [
        "/sign-in/username",
        "/sign-in/email",
        "/sign-up/email",
        "/forget-password",
        "/request-password-reset",
      ],
    }),
    organization({
      membershipLimit: 500,
      schema: {
        organization: {
          additionalFields: {
            teamName: {type: "string"},
            eventName: {type: "string"},
            password: {type: "string"},
            comment: {type: "string", required: false},
            googleAccessToken: {type: "string", required: false},
            googleRefreshToken: {type: "string", required: false},
            googleTokenExpiresAt: {type: "date", required: false},
            googleFolderId: {type: "string", required: false},
            googleTemplateFileId: {type: "string", required: false},
            discordGuildId: {type: "string", required: false},
            tags: {type: "string[]", required: false, default: ["crossword", "physical"]},
          },
        },
      },
    }),
    username(),
    haveIBeenPwned(),
    tanstackStartCookies(),
  ],
  session: {cookieCache: {enabled: true, maxAge: 5 * 60}},
});
