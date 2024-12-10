import { puzzlesRouter } from "./routes/puzzles";
import { roundsRouter } from "./routes/rounds";
import { workspacesRouter } from "./routes/workspaces";
import { router } from "./trpc";

export const appRouter = router({
  puzzles: puzzlesRouter,
  rounds: roundsRouter,
  workspaces: workspacesRouter,
});

export type AppRouter = typeof appRouter;
