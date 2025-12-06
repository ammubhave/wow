import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {betterAuth} from "better-auth/minimal";
import {username} from "better-auth/plugins";
import {organization} from "better-auth/plugins";
import {tanstackStartCookies} from "better-auth/tanstack-start";

import {db} from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {provider: "sqlite", schema}),
  experimental: {joins: true},
  emailAndPassword: {enabled: true},
  plugins: [
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
          },
        },
      },
    }),
    username(),
    tanstackStartCookies(),
  ],
});
