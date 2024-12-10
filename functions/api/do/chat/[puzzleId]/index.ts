import { z } from "zod";

import { getDb } from "../../../../../server/db";

export const onRequest: PagesFunction<Env> = async (context) => {
  const puzzleId = z.string().parse(context.params.puzzleId);
  const { db } = await getDb(context);
  if (puzzleId.startsWith("meta-")) {
    await db.metaPuzzle.findFirstOrThrow({
      where: { id: puzzleId },
      select: { id: true },
    });
  } else {
    await db.puzzle.findFirstOrThrow({
      where: { id: puzzleId },
      select: { id: true },
    });
  }
  const room = context.env.CHAT_ROOMS.get(
    context.env.CHAT_ROOMS.idFromName(puzzleId),
  );
  return room.fetch(context.request);
};
