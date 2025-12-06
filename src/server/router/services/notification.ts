import {env} from "cloudflare:workers";

export class NotificationService {
  async broadcast(workspaceId: string, data: {type: "invalidate"}) {
    const room = env.NOTIFICATION_ROOMS.getByName(workspaceId);
    await room.broadcast({...data, timestamp: Date.now()});
  }
}
