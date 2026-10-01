/**
 * Optimistic mutations for workspace data.
 *
 * The workspace room's websocket is the source of truth: each broadcast is written into the
 * TanStack Query cache (`workspaceQueryOptions`). Mutations here never touch that cache. Instead
 * each one carries a pure `meta.optimistic` recipe, and `WorkspaceProvider` renders
 * `recipes(pending mutations)(server state)` — TanStack Query's "optimistic updates via the UI"
 * (https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates), applied
 * across every component through `useMutationState`. This means:
 *  - every view (board, sidebar, filters, puzzle page) sees a change the instant it's made;
 *  - concurrent edits stack in order, and a broadcast arriving mid-flight can't clobber them;
 *  - a failed mutation simply stops being pending, so it rolls back by itself.
 *
 * A mutation stays pending (keeping its overlay) until the broadcast that includes it has arrived,
 * so a value never flickers back between the HTTP response and the websocket message. Recipes must
 * therefore be idempotent: applied to a state that already contains the change, they return it
 * unchanged (e.g. a create only inserts when the id is absent).
 */
import {
  hashKey,
  type MutationFunctionContext,
  type QueryClient,
  queryOptions,
  replaceEqualDeep,
  skipToken,
} from "@tanstack/react-query";
import {toast} from "sonner";
import {v7 as uuid7} from "uuid";

import {orpc} from "@/lib/orpc";
import type {WorkspaceRoomWireState} from "@/server/do/workspace";
import type {RouterInputs} from "@/server/router";

type Wire = WorkspaceRoomWireState;
type WireRound = Wire["rounds"][number];
type WirePuzzle = WireRound["puzzles"][number];
type Recipe<TInput> = (wire: Wire, input: TInput) => Wire;

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Applied on top of the workspace room state while the mutation is pending. */
      optimistic?: Recipe<never>;
      /** Skip the global invalidate-everything after success (see src/router.tsx). */
      invalidates?: false;
    };
  }
}

/** The workspace room state, written by the websocket in `WorkspaceProvider` (never fetched). */
export function workspaceQueryOptions(workspaceSlug: string) {
  return queryOptions<Wire>({
    queryKey: ["workspace", workspaceSlug],
    queryFn: skipToken,
    staleTime: Infinity,
  });
}

/** Folds the pending optimistic mutations, in the order they were made, over the server state. */
export function applyOptimistic(
  wire: Wire,
  pending: readonly {apply: Recipe<never>; variables: unknown}[]
) {
  return pending.reduce(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- each recipe was registered with its own mutation's input type, and `variables` is that mutation's input.
    (state, {apply, variables}) => (apply as Recipe<unknown>)(state, variables),
    wire
  );
}

/** Resolves once applying `apply` to the cached server state is a no-op, or after `timeoutMs`. */
function untilBroadcast<TInput extends {workspaceSlug: string}>(
  client: QueryClient,
  input: TInput,
  apply: Recipe<TInput>,
  timeoutMs = 5000
) {
  const {queryKey} = workspaceQueryOptions(input.workspaceSlug);
  const isConfirmed = () => {
    const wire = client.getQueryData(queryKey);
    return !wire || replaceEqualDeep(wire, apply(wire, input)) === wire;
  };
  if (isConfirmed()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const hash = hashKey(queryKey);
    const done = () => {
      unsubscribe();
      clearTimeout(timer);
      resolve();
    };
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (event.type === "updated" && event.query.queryHash === hash && isConfirmed()) done();
    });
    // Someone else may have changed the same thing meanwhile; then stop overriding it.
    const timer = setTimeout(done, timeoutMs);
  });
}

function optimistic<TInput extends {workspaceSlug: string}>(apply: Recipe<TInput>) {
  return {
    meta: {optimistic: apply as Recipe<never>, invalidates: false as const},
    onError: (error: unknown) => {
      toast.error("Couldn't save your change", {
        description: error instanceof Error ? error.message : undefined,
      });
    },
    onSettled: async (
      _data: unknown,
      error: unknown,
      input: TInput,
      _onMutateResult: unknown,
      {client}: MutationFunctionContext
    ) => {
      if (!error) await untilBroadcast(client, input, apply);
    },
  };
}

// --- Recipes -------------------------------------------------------------------------------

const mapRounds = (wire: Wire, fn: (round: WireRound) => WireRound): Wire => ({
  ...wire,
  rounds: wire.rounds.map(fn),
});

const mapPuzzles = (wire: Wire, fn: (puzzle: WirePuzzle) => WirePuzzle): Wire =>
  mapRounds(wire, round => ({...round, puzzles: round.puzzles.map(fn)}));

const findPuzzle = (wire: Wire, id: string) =>
  wire.rounds.flatMap(round => round.puzzles).find(puzzle => puzzle.id === id);

/** Only the keys the caller actually set (`undefined` means "leave unchanged"). */
function defined<T extends object>(value: T) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fromEntries loses the key types; only entries of `value` are kept.
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function updatePuzzle(wire: Wire, input: RouterInputs["puzzles"]["update"]): Wire {
  const {workspaceSlug: _, id, parentPuzzleId, answer, comment, ...fields} = input;
  const patch: Partial<WirePuzzle> = defined({
    ...fields,
    // Mirror the server's input transforms.
    answer: answer === undefined ? undefined : (answer?.toUpperCase() ?? null),
    comment: comment === undefined ? undefined : comment || null,
  });
  // `parentPuzzleId` is a round id (move there, unassigned) or a meta puzzle id (move under it).
  let roundId: string | undefined;
  if (parentPuzzleId !== undefined) {
    const targetRound = parentPuzzleId && wire.rounds.find(round => round.id === parentPuzzleId);
    if (targetRound) {
      roundId = targetRound.id;
      patch.parentPuzzleId = null;
    } else {
      patch.parentPuzzleId = parentPuzzleId;
      if (parentPuzzleId) roundId = findPuzzle(wire, parentPuzzleId)?.roundId;
    }
  }
  const puzzle = findPuzzle(wire, id);
  if (!puzzle) return wire;
  const updated = {...puzzle, ...patch, roundId: roundId ?? puzzle.roundId};
  if (updated.roundId === puzzle.roundId) {
    return mapPuzzles(wire, p => (p.id === id ? updated : p));
  }
  return mapRounds(wire, round => {
    if (round.id === puzzle.roundId) {
      return {...round, puzzles: round.puzzles.filter(p => p.id !== id)};
    }
    if (round.id === updated.roundId) return {...round, puzzles: [...round.puzzles, updated]};
    return round;
  });
}

function createPuzzle(wire: Wire, input: RouterInputs["puzzles"]["create"]): Wire {
  const {id} = input;
  if (!id) return wire;
  const parentPuzzleId = "parentPuzzleId" in input ? input.parentPuzzleId : null;
  const roundId =
    "roundId" in input
      ? input.roundId
      : parentPuzzleId && findPuzzle(wire, parentPuzzleId)?.roundId;
  if (!roundId) return wire;
  const isMetaPuzzle = input.type === "meta-puzzle";
  const now = new Date();
  const placeholder: WirePuzzle = {
    id,
    createdAt: now,
    updatedAt: now,
    roundId,
    name: input.name,
    link: input.link,
    googleSpreadsheetId: null,
    googleDrawingId: null,
    answer: null,
    status: null,
    importance: "normal",
    comment: null,
    commentUpdatedAt: null,
    commentUpdatedBy: null,
    isMetaPuzzle,
    parentPuzzleId,
    tags: input.tags,
  };
  const assignUnassigned = input.type === "meta-puzzle" && input.assignUnassignedPuzzles;
  const exists = findPuzzle(wire, id) !== undefined;
  return mapRounds(wire, round => {
    if (round.id !== roundId) return round;
    const puzzles = assignUnassigned
      ? round.puzzles.map(p =>
          p.id !== id && !p.isMetaPuzzle && p.parentPuzzleId === null
            ? {...p, parentPuzzleId: id}
            : p
        )
      : round.puzzles;
    return {...round, puzzles: exists ? puzzles : [...puzzles, placeholder]};
  });
}

function deletePuzzle(wire: Wire, input: RouterInputs["puzzles"]["delete"]): Wire {
  if (!findPuzzle(wire, input.id)) return wire;
  return mapRounds(wire, round => ({
    ...round,
    puzzles: round.puzzles
      .filter(p => p.id !== input.id)
      // ON DELETE SET NULL: its feeders become unassigned.
      // oxlint-disable-next-line oxc/no-map-spread -- must not mutate: the server state is shared.
      .map(p => (p.parentPuzzleId === input.id ? {...p, parentPuzzleId: null} : p)),
  }));
}

function createRound(wire: Wire, input: RouterInputs["rounds"]["create"]): Wire {
  const {id} = input;
  if (!id || wire.rounds.some(round => round.id === id)) return wire;
  const now = new Date();
  const round: WireRound = {
    id,
    createdAt: now,
    updatedAt: now,
    workspaceId: wire.id,
    name: input.name,
    status: null,
    puzzles: [],
  };
  return {...wire, rounds: [...wire.rounds, round]};
}

function updateRound(wire: Wire, input: RouterInputs["rounds"]["update"]): Wire {
  const {workspaceSlug: _, id, ...fields} = input;
  return mapRounds(wire, round => (round.id === id ? {...round, ...defined(fields)} : round));
}

function deleteRound(wire: Wire, input: RouterInputs["rounds"]["delete"]): Wire {
  return {...wire, rounds: wire.rounds.filter(round => round.id !== input.id)};
}

function assignUnassignedPuzzles(
  wire: Wire,
  input: RouterInputs["rounds"]["assignUnassignedPuzzles"]
): Wire {
  const parent = findPuzzle(wire, input.parentPuzzleId);
  if (!parent?.isMetaPuzzle) return wire;
  return mapPuzzles(wire, p =>
    p.roundId === parent.roundId && !p.isMetaPuzzle && p.parentPuzzleId === null
      ? {...p, parentPuzzleId: parent.id}
      : p
  );
}

function updateWorkspace(wire: Wire, input: RouterInputs["workspaces"]["update"]): Wire {
  const {workspaceSlug: _, comment, ...fields} = input;
  return {
    ...wire,
    ...defined({...fields, comment: comment === undefined ? undefined : comment || null}),
  };
}

// --- Mutation options ----------------------------------------------------------------------

/**
 * `useMutation(workspaceMutations.puzzles.update())` etc. Fire them with `mutate` (not
 * `mutateAsync`): the UI has already updated, and errors are toasted and rolled back here.
 */
export const workspaceMutations = {
  puzzles: {
    create: () => orpc.puzzles.create.mutationOptions(optimistic(createPuzzle)),
    update: () => orpc.puzzles.update.mutationOptions(optimistic(updatePuzzle)),
    delete: () => orpc.puzzles.delete.mutationOptions(optimistic(deletePuzzle)),
  },
  rounds: {
    create: () => orpc.rounds.create.mutationOptions(optimistic(createRound)),
    update: () => orpc.rounds.update.mutationOptions(optimistic(updateRound)),
    delete: () => orpc.rounds.delete.mutationOptions(optimistic(deleteRound)),
    assignUnassignedPuzzles: () =>
      orpc.rounds.assignUnassignedPuzzles.mutationOptions(optimistic(assignUnassignedPuzzles)),
  },
  workspaces: {update: () => orpc.workspaces.update.mutationOptions(optimistic(updateWorkspace))},
};

/** Client-side ids for creates, so the optimistic row becomes the real one without remounting. */
export const newId = () => uuid7();

/**
 * Favorites live in the member query (not the workspace room), so this is the classic
 * "optimistic update via the cache": cancel in-flight fetches, write the cache, roll back on
 * error, and refetch once the last of several rapid toggles settles.
 */
export function setFavoritesMutationOptions() {
  const mutationKey = orpc.workspaces.members.set.mutationKey();
  return orpc.workspaces.members.set.mutationOptions({
    meta: {invalidates: false},
    onMutate: async (input, {client}) => {
      const queryKey = orpc.workspaces.members.get.queryKey({
        input: {workspaceSlug: input.workspaceSlug},
      });
      await client.cancelQueries({queryKey});
      const previous = client.getQueryData(queryKey);
      client.setQueryData(queryKey, old =>
        old ? {...old, favoritePuzzleIds: input.favoritePuzzleIds} : old
      );
      return {queryKey, previous};
    },
    onError: (_error, _input, onMutateResult, {client}) => {
      if (onMutateResult) client.setQueryData(onMutateResult.queryKey, onMutateResult.previous);
      toast.error("Couldn't update your favorites");
    },
    onSettled: (_data, _error, _input, onMutateResult, {client}) => {
      // Refetching while another toggle is in flight would briefly show a stale list.
      return onMutateResult && client.isMutating({mutationKey}) === 1
        ? client.invalidateQueries({queryKey: onMutateResult.queryKey})
        : undefined;
    },
  });
}
