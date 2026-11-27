import type {InferRouterInputs, InferRouterOutputs} from "@orpc/server";

import {exchangeRouter} from "./exchange";
import {guessesRouter} from "./guesses";
import {huntListingsRouter} from "./hunt-listings";
import {meRouter} from "./me";
import {pushRouter} from "./push";
import {puzzlesRouter} from "./puzzles";
import {roundsRouter} from "./rounds";
import {workspacesRouter} from "./workspaces";

export const router = {
  puzzles: puzzlesRouter,
  guesses: guessesRouter,
  rounds: roundsRouter,
  workspaces: workspacesRouter,
  exchange: exchangeRouter,
  me: meRouter,
  huntListings: huntListingsRouter,
  push: pushRouter,
};

export type RouterInputs = InferRouterInputs<typeof router>;
export type RouterOutputs = InferRouterOutputs<typeof router>;
