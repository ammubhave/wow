import type {InferRouterInputs, InferRouterOutputs} from "@orpc/server";

import {exchangeRouter} from "./exchange";
import {puzzlesRouter} from "./puzzles";
import {roundsRouter} from "./rounds";
import {workspacesRouter} from "./workspaces";

export const router = {
  puzzles: puzzlesRouter,
  rounds: roundsRouter,
  workspaces: workspacesRouter,
  exchange: exchangeRouter,
};

export type RouterInputs = InferRouterInputs<typeof router>;
export type RouterOutputs = InferRouterOutputs<typeof router>;
