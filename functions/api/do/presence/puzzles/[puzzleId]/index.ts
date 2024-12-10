import { z } from "zod";

import { getDb } from "../../../../../../server/db";

export const onRequest: PagesFunction<Env> = async (context) => {
  const puzzleId = z.string().parse(context.params.puzzleId);
  const { db } = await getDb(context);
  const { id: workspaceId } = await db.workspace.findFirstOrThrow({
    where: {
      OR: [
        {
          rounds: {
            some: {
              unassignedPuzzles: {
                some: {
                  id: puzzleId,
                },
              },
            },
          },
        },
        {
          rounds: {
            some: {
              metaPuzzles: {
                some: {
                  puzzles: {
                    some: {
                      id: puzzleId,
                    },
                  },
                },
              },
            },
          },
        },
        {
          rounds: {
            some: {
              metaPuzzles: {
                some: {
                  id: puzzleId,
                },
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const room = context.env.PRESENCE_ROOMS.get(
    context.env.PRESENCE_ROOMS.idFromName(workspaceId),
  );
  return room.fetch(context.request);
};
