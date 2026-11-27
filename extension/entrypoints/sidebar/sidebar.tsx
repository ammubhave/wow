import {Resizable} from "@heroui-pro/react/resizable";
import {Alert, Button, buttonVariants, Spinner} from "@heroui/react";
import {ORPCError} from "@orpc/client";
import {useMutation} from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  type ErrorComponentProps,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {ExternalLinkIcon, PanelRightCloseIcon} from "lucide-react";
import {useEffect, useState} from "react";

import {Chat} from "@/components/chat";
import {IconButton} from "@/components/icon-button";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {PuzzleInfoPanel} from "@/components/puzzle-info-panel";
import {AwardsProvider} from "@/features/awards/awards-provider";
import {VoiceProvider} from "@/features/voice/voice-provider";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {WorkspaceProvider} from "@/hooks/use-workspace";
import {useWorkspace} from "@/hooks/use-workspace";
import {
  formatAnswers,
  joinAnswers,
  normalizeAnswer,
  solvedByAnswer,
  splitAnswers,
} from "@/lib/answers";
import {usePuzzle} from "@/lib/usePuzzle";
import {workspaceMutations, workspaceQueryOptions} from "@/lib/workspace-mutations";
import {applyAccent} from "@/lib/workspace-theme";

import type {PageMessage, SidebarMessage} from "../../lib/messages";
import {signIn, startPageAuth, useExtensionUser} from "../../lib/page-auth";
import {queryClient} from "../../lib/providers";
import {wowPuzzleUrl} from "../../lib/settings";

const ORIGIN = import.meta.env.WOW_ORIGIN;

/** Tells the content script hosting this frame (on the hunt's page, whatever its origin). */
const tellPage = (message: SidebarMessage) => window.parent.postMessage(message, "*");

/** Asks the content script hosting this frame to collapse it to a tab on the page's edge. */
const collapse = () => tellPage({source: "wow-sidebar", type: "collapse"});

/**
 * The sidebar: the puzzle's details (editable, as on its WOW page) above its chat, with the call
 * controls and who's there. It's the website's own components, under a router shaped like the
 * website's (same route ids, so they find the workspace and puzzle in it) on an in-memory history
 * that never moves: any link they render opens that page in WOW, in a new tab.
 */
export function Sidebar({workspaceSlug, puzzleId}: {workspaceSlug: string; puzzleId: string}) {
  const user = useExtensionUser();
  useEffect(() => void startPageAuth(), []);
  if (user === undefined)
    return (
      <Centered>
        <Spinner />
      </Centered>
    );
  if (user === null) return <SignedOut />;
  return <SidebarRouter workspaceSlug={workspaceSlug} puzzleId={puzzleId} />;
}

function SidebarRouter({workspaceSlug, puzzleId}: {workspaceSlug: string; puzzleId: string}) {
  const [router] = useState(() => {
    const history = createMemoryHistory({
      initialEntries: [`/${workspaceSlug}/puzzles/${puzzleId}`],
    });
    history.block({
      blockerFn: ({nextLocation}) => {
        window.open(`${ORIGIN}${nextLocation.href}`, "_blank", "noopener");
        return true;
      },
      enableBeforeUnload: false,
    });
    return createRouter({routeTree, history, context: {queryClient}, defaultPendingMs: 0});
  });
  return <RouterProvider router={router} />;
}

const rootRoute = createRootRouteWithContext<{queryClient: typeof queryClient}>()({
  component: Outlet,
});
// Same ids as the website's routes (`/_workspace/$workspaceSlug/puzzles/$puzzleId`).
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_workspace",
  component: Outlet,
});
const workspaceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "$workspaceSlug",
  loader: ({context, params}) =>
    context.queryClient.ensureQueryData(workspaceQueryOptions(params.workspaceSlug)),
  pendingComponent: () => (
    <Centered>
      <Spinner />
    </Centered>
  ),
  errorComponent: WorkspaceError,
  component: WorkspaceLayout,
});
const puzzleRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: "puzzles/$puzzleId",
  component: PuzzlePane,
});
const routeTree = rootRoute.addChildren([
  appRoute.addChildren([workspaceRoute.addChildren([puzzleRoute])]),
]);

/** The workspace's live state, presence, calls and awards, as the website's workspace layout. */
function WorkspaceLayout() {
  const {workspaceSlug} = workspaceRoute.useParams();
  return (
    <WorkspaceProvider key={workspaceSlug} workspaceSlug={workspaceSlug}>
      <PresencesWebSocket workspaceSlug={workspaceSlug}>
        <VoiceProvider workspaceSlug={workspaceSlug}>
          <AwardsProvider workspaceSlug={workspaceSlug}>
            <WorkspaceAccent />
            <Outlet />
          </AwardsProvider>
        </VoiceProvider>
      </PresencesWebSocket>
    </WorkspaceProvider>
  );
}

function WorkspaceAccent() {
  const {accent} = useWorkspace().theme;
  useEffect(() => applyAccent(accent), [accent]);
  return null;
}

function PuzzlePane() {
  const {workspaceSlug, puzzleId} = puzzleRoute.useParams();
  const puzzle = usePuzzle({puzzleId});
  const wowUrl = wowPuzzleUrl(workspaceSlug, puzzleId);
  const collapseButton = (
    <IconButton size="sm" variant="ghost" label="Collapse sidebar" onPress={collapse}>
      <PanelRightCloseIcon />
    </IconButton>
  );
  if (!puzzle.data) {
    return (
      <Centered>
        <p className="text-muted text-sm">This puzzle isn't in the workspace any more.</p>
        {collapseButton}
      </Centered>
    );
  }
  return (
    <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
      <div className="flex h-dvh flex-col">
        <Resizable orientation="vertical">
          <Resizable.Panel defaultSize={50} className="flex flex-col">
            <SolveOffer workspaceSlug={workspaceSlug} puzzle={puzzle.data} />
            <PuzzleInfoPanel
              key={puzzleId}
              workspaceSlug={workspaceSlug}
              puzzle={puzzle.data}
              shareUrl={wowUrl}
              onDeleted={collapse}
              primaryLink={
                <a
                  className={buttonVariants({
                    variant: "secondary",
                    size: "sm",
                    className: "shrink-0",
                  })}
                  href={wowUrl}
                  target="_blank"
                  rel="noopener noreferrer">
                  Open in WOW
                  <ExternalLinkIcon />
                </a>
              }
              headerEnd={collapseButton}
            />
          </Resizable.Panel>
          <Resizable.Handle type="drag" />
          <Resizable.Panel defaultSize={50} className="flex flex-col">
            <Chat key={puzzleId} puzzleId={puzzleId} />
          </Resizable.Panel>
        </Resizable>
      </div>
    </PresencesWebSocket>
  );
}

/**
 * What the hunt's page says the puzzle was solved as: the content script reads it (and reads it
 * again as the page changes) and posts it here once this frame says it's ready.
 */
function useHuntSolve() {
  const [answer, setAnswer] = useState<string | null>(null);
  useEffect(() => {
    const listener = (event: MessageEvent<PageMessage>) => {
      if (event.source !== window.parent) return;
      if (event.data?.source === "wow-page" && event.data.type === "huntSolve") {
        setAnswer(event.data.answer);
      }
    };
    window.addEventListener("message", listener);
    tellPage({source: "wow-sidebar", type: "ready"});
    return () => window.removeEventListener("message", listener);
  }, []);
  return answer;
}

const dismissedKey = (puzzleId: string) => `huntSolveDismissed:${puzzleId}`;

/**
 * When the hunt's page says the puzzle is solved with an answer WOW doesn't have yet: offers to
 * put it in (and mark the puzzle solved), in one click. A puzzle with several answers gets it
 * added to the ones found so far; one with a different answer in WOW, replaced. Dismissing it
 * hides it for that answer (the page saying something else brings it back).
 */
function SolveOffer({
  workspaceSlug,
  puzzle,
}: {
  workspaceSlug: string;
  puzzle: {id: string; answer: string | null; answerCount: number; status: string | null};
}) {
  const found = useHuntSolve();
  const isReadOnly = useIsReadOnly();
  const {mutate} = useMutation(workspaceMutations.puzzles.update());
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const key = dismissedKey(puzzle.id);
    void (async () => {
      const value = (await browser.storage.local.get(key))[key];
      setDismissed(typeof value === "string" ? value : null);
    })();
  }, [puzzle.id]);

  const answers = splitAnswers(puzzle.answer);
  const normalized = found ? normalizeAnswer(found) : null;
  const missing = answers.length < Math.max(1, puzzle.answerCount);
  const shown =
    found !== null &&
    normalized !== null &&
    !isReadOnly &&
    dismissed !== undefined &&
    dismissed !== normalized &&
    !answers.some(a => normalizeAnswer(a) === normalized);

  useEffect(() => {
    tellPage({source: "wow-sidebar", type: "solveOffer", shown});
  }, [shown]);

  if (!shown) return null;
  // Several answers and some still to find: add this one. Otherwise it's the answer.
  const adding = puzzle.answerCount > 1 && missing;
  const replacing = !adding && answers.length > 0;
  const accept = () => {
    const answer = joinAnswers(adding ? [...answers, found] : [found]);
    mutate({workspaceSlug, id: puzzle.id, answer: answer ?? "", ...solvedByAnswer(answer, puzzle)});
  };
  const dismiss = () => {
    setDismissed(normalized);
    void browser.storage.local.set({[dismissedKey(puzzle.id)]: normalized});
  };
  return (
    <Alert status="success" className="m-2 mb-0 shrink-0">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {adding ? "The hunt accepted " : "The hunt says this is solved: "}
          <span className="font-mono font-semibold">{found}</span>
        </Alert.Title>
        {replacing && (
          <Alert.Description>WOW has {formatAnswers(puzzle.answer)}.</Alert.Description>
        )}
        <div className="mt-2 flex gap-2">
          <Button size="sm" onPress={accept}>
            {adding ? "Add answer" : replacing ? "Use the hunt's answer" : "Mark solved"}
          </Button>
          <Button size="sm" variant="ghost" onPress={dismiss}>
            Dismiss
          </Button>
        </div>
      </Alert.Content>
    </Alert>
  );
}

function WorkspaceError({error}: ErrorComponentProps) {
  const forbidden =
    error instanceof ORPCError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND");
  return (
    <Centered>
      <p className="text-muted text-sm">
        {forbidden ? "You're not in this workspace any more." : "Couldn't load the workspace."}
      </p>
      <Button size="sm" variant="secondary" onPress={() => location.reload()}>
        Try again
      </Button>
    </Centered>
  );
}

function SignedOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Centered>
      <p className="text-sm">Sign in to WOW to see this puzzle here.</p>
      {error && <p className="text-danger text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          isPending={pending}
          onPress={() => {
            setPending(true);
            setError(undefined);
            signIn()
              .then(() => queryClient.invalidateQueries())
              .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't sign in."))
              .finally(() => setPending(false));
          }}>
          Sign in
        </Button>
        <IconButton size="sm" variant="ghost" label="Collapse sidebar" onPress={collapse}>
          <PanelRightCloseIcon />
        </IconButton>
      </div>
    </Centered>
  );
}

function Centered({children}: {children: React.ReactNode}) {
  return (
    <div className="bg-surface flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      {children}
    </div>
  );
}
