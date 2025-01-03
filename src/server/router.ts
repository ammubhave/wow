import { commentsRouter } from "./routes/comments";
import { puzzlesRouter } from "./routes/puzzles";
import { roundsRouter } from "./routes/rounds";
import { workspacesRouter } from "./routes/workspaces";
import { router } from "./trpc";

export const appRouter = router({
  puzzles: puzzlesRouter,
  rounds: roundsRouter,
  workspaces: workspacesRouter,
  comments: commentsRouter,
});

export type AppRouter = typeof appRouter;
