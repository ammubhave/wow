import { Context } from "../trpc";

export class NotificationService {
  constructor(
    private readonly env: Env,
    private readonly ctx: Context,
  ) {}

  async broadcast(
    workspaceId: string,
    data: // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { type: "notification"; paths: { path: string[]; input?: any }[] }
      | {
          type: "message";
          text: string;
        },
  ) {
    const room = this.env.NOTIFICATION_ROOMS.get(
      this.env.NOTIFICATION_ROOMS.idFromName(workspaceId),
    );
    await room.broadcast(
      JSON.stringify({
        ...data,
        timestamp: Date.now(),
      }),
    );
  }
}
