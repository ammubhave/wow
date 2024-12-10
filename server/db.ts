import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { enhance } from "@zenstackhq/runtime";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

export async function getDb(context: {
  env: { TURSO_URL: string; TURSO_AUTH_TOKEN?: string };
  request: { headers: Headers; url: string };
}) {
  const libsql = createClient({
    url: context.env.TURSO_URL,
    authToken: context.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  const prisma = new PrismaClient({ adapter });
  console.log("prisma", prisma);
  const url = new URL(context.request.url);
  const jwt = z.string().parse(url.searchParams.get("token"));
  const payload = z
    .object({
      given_name: z.string(),
      email: z.string(),
      sub: z.string(),
    })
    .parse(
      (
        await jwtVerify(
          jwt,
          createRemoteJWKSet(
            new URL("https://auth.wafflehaus.io/.well-known/jwks"),
          ),
        )
      ).payload,
    );
  const db = enhance(prisma, { user: { id: payload.sub } });
  return { db, prisma, userId: payload.sub };
}
