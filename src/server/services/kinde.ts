import { z } from "zod";

import { Context } from "../trpc";

export class KindeService {
  constructor(
    private readonly env: Env,
    private readonly ctx: Context,
  ) {}

  async getKindeM2MAccessToken() {
    return z.object({ access_token: z.string() }).parse(
      await (
        await fetch(`https://wafflehaus.kinde.com/oauth2/token`, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            audience: "https://wafflehaus.kinde.com/api",
            grant_type: "client_credentials",
            client_id: this.env.KINDE_CLIENT_ID,
            client_secret: this.env.KINDE_CLIENT_SECRET,
          }),
        })
      ).json(),
    ).access_token;
  }
}
