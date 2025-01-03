import { z } from "zod";

import { procedure, router } from "../trpc";

export const commentsRouter = router({
  findComment: procedure
    .input(
      z.union([
        z.object({ metaPuzzleId: z.string() }),
        z.object({ puzzleId: z.string() }),
        z.object({ workspaceId: z.string() }),
      ]))
    .query(async ({ ctx, input }) => {
      return await ctx.db.comment.findFirst({
        where: {
          ...makeCommentIndex(input),
          active: true,
         },
        select: {
          text: true,
        },
      });
    }),

  create: procedure
    .input(
        z.object({ text: z.string() })
        .and(
            z.union([
              z.object({ metaPuzzleId: z.string() }),
              z.object({ puzzleId: z.string() }),
              z.object({ workspaceId: z.string() }),
            ])
        )
    )
    .mutation(async ({ ctx, input }) => {
      let comment;
      await ctx.db.$transaction(async (tx) => {
        const commentId = makeCommentIndex(input);

        // Make sure any old comments are not active.
        await tx.comment.updateMany({
          data: {
            active: false,
          },
          where: {
            ...commentId,
            active: true,
          },
        });

        // Make a new comment that's active by default.
        comment = await tx.comment.create({
          data: {
              text: input.text,
              active: true,
              ...commentId,
          },
        });

        // If there are too many comments, delete off the front.
        const matchingComments = await tx.comment.findMany({
          where: commentId,
          select: { id: true },
          orderBy: { updatedAt: 'asc' },
        });
        while (matchingComments.length > 10) {
          const firstComment = matchingComments.shift();
          await tx.comment.delete({
            where: {
              ...commentId,
              id: firstComment?.id,
            }
          });
        }
      });
      return comment;
    }),
});

function makeCommentIndex(input) {
  if ("metaPuzzleId" in input) {
    return { metaPuzzleId: input.metaPuzzleId };
  } else if ("puzzleId" in input) {
    return { puzzleId: input.puzzleId };
  } else {
    return { workspaceId: input.workspaceId };
  }
}