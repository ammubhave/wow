import {Button} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {useNavigate, useRouterState} from "@tanstack/react-router";
import {CompassIcon, XIcon} from "lucide-react";
import {createContext, useCallback, useContext, useEffect, useMemo, useRef} from "react";
import {toast} from "sonner";
import {useMediaQuery} from "usehooks-ts";

import {IconButton} from "@/components/icon-button";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {ARCHIVED_MESSAGE_START} from "@/lib/archived";
import {errorMessage} from "@/lib/errors";
import {orpc} from "@/lib/orpc";
import {type TourKind, type TourState, parseTourState} from "@/lib/tour-state";
import {newId, workspaceMutations} from "@/lib/workspace-mutations";

import {EXAMPLE_NAMES, TOURS, type TourContext, type TourStep, allPuzzles} from "./steps";
import {TourCard} from "./tour-card";

/**
 * The onboarding tour: walks a new workspace's creator (or a new member) through the app, one
 * popover at a time, pointing at the real thing. Where it is is saved on their member row, so it
 * picks up where they left off on any device, and closing it ends it for good (Help, or ⌘K, start
 * it again).
 */

type TourApi = {
  /** Starts (or restarts) the tour: the captain's for owners, the solver's for everyone else. */
  start: (kind?: TourKind) => void;
  isRunning: boolean;
};

const TourApiContext = createContext<TourApi | null>(null);

/** The tour's controls, or null outside a workspace (e.g. the public docs). */
export const useTour = () => useContext(TourApiContext);

export function TourProvider({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const memberQuery = orpc.workspaces.members.get.queryOptions({input: {workspaceSlug}});
  const {data: member} = useQuery(memberQuery);
  const state = parseTourState(member?.tour);
  const {mutate: saveTour} = useMutation(
    orpc.workspaces.members.setTour.mutationOptions({
      meta: {invalidates: false},
      onMutate: async (input, {client}) => {
        await client.cancelQueries({queryKey: memberQuery.queryKey});
        client.setQueryData(memberQuery.queryKey, old => (old ? {...old, tour: input.tour} : old));
      },
      onError: (error, _input, _result, {client}) => {
        // Back to what's saved, so the tour doesn't act on progress that wasn't kept.
        void client.invalidateQueries({queryKey: memberQuery.queryKey});
        // Archived workspaces are reported once by the global handler (router.tsx); one message
        // however many steps fail.
        if (!error.message.startsWith(ARCHIVED_MESSAGE_START)) {
          toast.error(errorMessage(error, "Couldn't save your tour progress."), {
            id: "tour-save-failed",
          });
        }
      },
    })
  );
  const save = useCallback(
    (tour: TourState) => saveTour({workspaceSlug, tour}),
    [saveTour, workspaceSlug]
  );

  const isPhone = !useMediaQuery("(min-width: 768px)");
  const pathname = useRouterState({select: s => s.location.pathname});
  const navigate = useNavigate();
  const base = `/${workspaceSlug}`;
  const openPuzzleId = pathname.startsWith(`${base}/puzzles/`)
    ? (pathname.split("/")[3] ?? null)
    : null;
  const onBoard = pathname === base || pathname === `${base}/`;

  // What the tour points at: the examples it made if they're still around, else what's there.
  const ctx = useMemo((): TourContext | null => {
    if (!state) return null;
    const puzzles = allPuzzles(workspace);
    const exists = (id: string | undefined) =>
      id !== undefined && puzzles.some(p => p.id === id) ? id : undefined;
    const examples = state.examples ?? {};
    const roundId =
      (examples.roundId && workspace.rounds.some(r => r.id === examples.roundId)
        ? examples.roundId
        : undefined) ??
      workspace.rounds[0]?.id ??
      null;
    const metaId =
      exists(examples.metaId) ??
      puzzles.find(p => p.isMetaPuzzle && p.childPuzzles.length > 0)?.id ??
      puzzles.find(p => p.isMetaPuzzle)?.id ??
      null;
    const feeders = puzzles.filter(p => !p.isMetaPuzzle);
    const puzzleId =
      exists(examples.puzzleIds?.find(id => exists(id))) ??
      (openPuzzleId && feeders.some(p => p.id === openPuzzleId) ? openPuzzleId : undefined) ??
      feeders.find(p => p.status !== "solved" && p.status !== "backsolved")?.id ??
      feeders[0]?.id ??
      null;
    return {workspace, state, isPhone, openPuzzleId, roundId, metaId, puzzleId};
  }, [workspace, state, isPhone, openPuzzleId]);

  const steps = state ? TOURS[state.kind] : [];
  const isLive = (step: TourStep) => (ctx ? !step.skip?.(ctx) : false);
  // The captain's puzzles don't exist until the tour has them made: count their steps from the
  // start, so "4 of 22" doesn't become "4 of 11" and grow.
  const planCtx =
    ctx && state?.kind === "captain"
      ? {...ctx, puzzleId: ctx.puzzleId ?? "planned", metaId: ctx.metaId ?? "planned"}
      : ctx;
  const planned = steps.filter(step => (planCtx ? !step.skip?.(planCtx) : false));
  // The saved step, or the next one still in the tour if it's been left out since (or unknown).
  const savedIndex = Math.max(
    0,
    steps.findIndex(step => step.id === state?.step)
  );
  const step = steps.slice(savedIndex).find(isLive) ?? steps.findLast(isLive);
  const index = step ? steps.indexOf(step) : -1;
  const nextStep = steps.slice(index + 1).find(isLive);
  const previousStep = steps.slice(0, Math.max(0, index)).findLast(isLive);
  const position = step
    ? Math.max(
        0,
        planned.findLastIndex(s => steps.indexOf(s) <= index)
      )
    : 0;
  // Paused in an archived workspace: its hands-on steps can't change anything there.
  const isReadOnly = useIsReadOnly();
  const isActive = state?.status === "active" && step !== undefined && ctx !== null && !isReadOnly;

  const isOnPage = (target: TourStep): boolean =>
    ({
      any: true,
      board: onBoard,
      puzzle: openPuzzleId !== null,
      meta: ctx?.metaId != null && openPuzzleId === ctx.metaId,
    })[target.page];

  /** Takes the person to where a step is, if they aren't there. */
  const goToPage = (target: TourStep) => {
    if (!ctx || isOnPage(target)) return;
    if (target.page === "board") {
      void navigate({to: "/$workspaceSlug", params: {workspaceSlug}});
      return;
    }
    const puzzleId = target.page === "meta" ? ctx.metaId : ctx.puzzleId;
    if (puzzleId) {
      void navigate({to: "/$workspaceSlug/puzzles/$puzzleId", params: {workspaceSlug, puzzleId}});
    }
  };

  // Going back, a step whose target is missing is skipped backwards too.
  const direction = useRef<1 | -1>(1);
  const go = (to: TourStep | undefined, dir: 1 | -1) => {
    if (!state) return;
    direction.current = dir;
    if (!to) {
      save({...state, status: "done"});
      track("tour_completed", {kind: state.kind});
      toast.success("That's the tour! Take it again any time from Help.");
      return;
    }
    save({...state, step: to.id});
    goToPage(to);
  };
  const next = () => step && go(nextStep, 1);
  const back = () => previousStep && go(previousStep, -1);
  const skipMissing = () => (direction.current === 1 || !previousStep ? next() : back());

  const close = () => {
    if (!state || !step) return;
    save({...state, status: "dismissed"});
    track("tour_skipped", {kind: state.kind, step: step.id});
    toast("Tour closed. You can take it again from Help.");
  };

  // A task moves on as soon as it's done (not if it was already done when the step came up, so
  // Back works; Next is there instead).
  const isDone = step?.task && ctx ? step.task.isDone(ctx) : false;
  const wasDone = useRef<{id: string; done: boolean} | null>(null);
  useEffect(() => {
    if (!isActive || !step) return;
    const previous = wasDone.current;
    wasDone.current = {id: step.id, done: isDone};
    if (previous?.id === step.id && !previous.done && isDone) next();
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only on the task's state changing.
  }, [isActive, step?.id, isDone]);

  // "Do it for me": example rounds and puzzles, made like the dialogs make them.
  const {mutate: createRound} = useMutation(workspaceMutations.rounds.create());
  const {mutate: createPuzzle} = useMutation(workspaceMutations.puzzles.create());
  const doItForMe = () => {
    if (!state || !ctx || !step?.task) return;
    track("tour_did_it_for_me", {kind: state.kind, step: step.id});
    const examples = {...state.examples};
    const ensureRound = () => {
      if (ctx.roundId) return ctx.roundId;
      const id = newId();
      createRound({workspaceSlug, id, name: EXAMPLE_NAMES.round});
      examples.roundId = id;
      return id;
    };
    const ensureMeta = () => {
      if (ctx.metaId) return ctx.metaId;
      const id = newId();
      createPuzzle({
        workspaceSlug,
        id,
        type: "meta-puzzle",
        roundId: ensureRound(),
        assignUnassignedPuzzles: false,
        name: EXAMPLE_NAMES.meta,
        tags: [],
        link: "",
      });
      examples.metaId = id;
      return id;
    };
    switch (step.task.doItForMe) {
      case "round":
        ensureRound();
        break;
      case "meta":
        ensureMeta();
        break;
      case "feeders": {
        const parentPuzzleId = ensureMeta();
        examples.puzzleIds = EXAMPLE_NAMES.puzzles.map(name => {
          const id = newId();
          createPuzzle({
            workspaceSlug,
            id,
            type: "puzzle",
            parentPuzzleId,
            name,
            tags: [],
            link: "",
          });
          return id;
        });
        break;
      }
      case "open-puzzle":
        if (ctx.puzzleId) {
          void navigate({
            to: "/$workspaceSlug/puzzles/$puzzleId",
            params: {workspaceSlug, puzzleId: ctx.puzzleId},
          });
        }
        break;
    }
    // Saved before the new rows arrive, so the next steps point at them.
    if (JSON.stringify(examples) !== JSON.stringify(state.examples ?? {})) {
      save({...state, examples});
    }
  };

  const start = useCallback(
    (kind?: TourKind) => {
      const chosen = kind ?? (member?.role === "owner" ? "captain" : "solver");
      direction.current = 1;
      save({kind: chosen, step: null, status: "active", examples: state?.examples});
      track("tour_started", {kind: chosen});
    },
    [member?.role, save, state?.examples]
  );
  const api = useMemo(
    () => ({start, isRunning: state?.status === "active"}),
    [start, state?.status]
  );

  return (
    <TourApiContext.Provider value={api}>
      {children}
      {isActive &&
        step &&
        ctx &&
        (isOnPage(step) ? (
          <TourCard
            key={step.id}
            step={step}
            ctx={ctx}
            position={position}
            total={planned.length}
            isFirst={!previousStep}
            isLast={!nextStep}
            isDone={isDone}
            onNext={next}
            onBack={back}
            onClose={close}
            onDoItForMe={doItForMe}
            onMissing={skipMissing}
          />
        ) : (
          // Wandered off the step's page: offer to go back to it.
          <div className="fixed inset-x-0 bottom-12 z-60 flex justify-center px-4">
            <div className="bg-overlay shadow-overlay border-separator flex items-center gap-1 rounded-full border py-1 ps-3 pe-1 text-sm">
              <CompassIcon className="text-accent size-4" aria-hidden />
              <span className="ms-1">Tour paused</span>
              <Button size="sm" variant="ghost" onPress={() => goToPage(step)}>
                Resume
              </Button>
              <IconButton size="sm" variant="ghost" label="End tour" onPress={close}>
                <XIcon />
              </IconButton>
            </div>
          </div>
        ))}
    </TourApiContext.Provider>
  );
}
