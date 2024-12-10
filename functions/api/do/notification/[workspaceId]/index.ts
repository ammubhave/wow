import { z } from "zod";

import { getDb } from "../../../../../server/db";

export const onRequest: PagesFunction<Env> = async (context) => {
  const workspaceId = z.string().parse(context.params.workspaceId);
  const { db } = await getDb(context);
  await db.workspaceMembership.findFirstOrThrow({
    where: { workspaceId },
  });
  const room = context.env.NOTIFICATION_ROOMS.get(
    context.env.NOTIFICATION_ROOMS.idFromName(workspaceId),
  );
  return room.fetch(context.request);
};
