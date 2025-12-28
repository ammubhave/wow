import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {betterAuth} from "better-auth/minimal";
import {username} from "better-auth/plugins";
import {organization} from "better-auth/plugins";
import {captcha} from "better-auth/plugins";
import {tanstackStartCookies} from "better-auth/tanstack-start";

import {db} from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: "sqlite", schema}),
  experimental: {joins: true},
  emailAndPassword: {enabled: true},
  user: {additionalFields: {notificationsDisabled: {type: "boolean", default: false}}},
  trustedOrigins: [
    "https://wow-production.panchal-llc.workers.dev",
    "https://*-wow-production.panchal-llc.workers.dev",
  ],
  plugins: [
    captcha({
      provider: "cloudflare-turnstile",
      secretKey: process.env.TURNSTILE_SECRET_KEY!,
      endpoints: ["/sign-in/username", "/sign-up/email"],
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
    tanstackStartCookies(),
  ],
});
