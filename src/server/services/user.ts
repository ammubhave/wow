import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { Context } from "../trpc";

const PayloadSchema = z.object({
  given_name: z.string(),
  family_name: z.string().optional().nullable(),
  email: z.string(),
  sub: z.string(),
  picture: z.string().optional().nullable(),
});

export class UserService {
  public readonly id: string;
  public readonly firstName: string;
  public readonly lastName: string | undefined;
  public readonly fullName: string;
  public readonly picture: string | undefined;
  public readonly email: string;

  public static async create(ctx: Context, jwt: string) {
    const payload = PayloadSchema.parse(
      (
        await jwtVerify(
          jwt,
          createRemoteJWKSet(
            new URL("https://auth.wafflehaus.io/.well-known/jwks"),
          ),
        )
      ).payload,
    );
    await ctx.prisma.user.upsert({
      where: { id: payload.sub },
      create: {
        id: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name ?? undefined,
        picture: payload.picture ?? undefined,
      },
      update: {
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name ?? undefined,
        picture: payload.picture ?? undefined,
      },
    });
    return new UserService(ctx, payload);
  }

  private constructor(
    private readonly ctx: Context,
    payload: z.infer<typeof PayloadSchema>,
  ) {
    this.id = payload.sub;
    this.firstName = payload.given_name;
    this.lastName = payload.family_name ?? undefined;
    this.fullName =
      payload.given_name +
      (payload.family_name ? " " + payload.family_name : "");
    this.picture = payload.picture ?? undefined;
    this.email = payload.email;
  }
}
