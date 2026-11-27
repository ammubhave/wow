import {Resizable} from "@heroui-pro/react/resizable";
import {Button, buttonVariants, Chip, Spinner, Tabs, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute, useNavigate} from "@tanstack/react-router";
import {ExternalLinkIcon, PresentationIcon, SheetIcon, TimerIcon} from "lucide-react";
import {type ReactNode, useEffect, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";
import {useMediaQuery} from "usehooks-ts";
import {z} from "zod";

import {Chat} from "@/components/chat";
import {NotFoundPage} from "@/components/not-found-page";
import {PuzzlePageSkeleton, SheetSkeleton} from "@/components/page-skeletons";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {PuzzleInfoPanel} from "@/components/puzzle-info-panel";
import {PuzzleSheet} from "@/components/sheet/sheet";
import {PuzzleWhiteboard} from "@/components/whiteboard/whiteboard";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {formatPuzzleTime, usePuzzleTimeTracker} from "@/hooks/use-puzzle-time";
import {track} from "@/lib/analytics";
import type {GoogleFileJob} from "@/lib/db/schema";
import {errorMessage} from "@/lib/errors";
import {client} from "@/lib/orpc";
import {usePuzzle} from "@/lib/usePuzzle";
import {findPuzzle, workspaceQueryOptions} from "@/lib/workspace-mutations";

export const Route = createFileRoute("/_workspace/$workspaceSlug/puzzles/$puzzleId")({
  // Which surface the left pane shows; in the URL so a shared link opens the same view.
  // On phones, chat and the puzzle's details are views too (on desktop they're always shown).
  validateSearch: z.object({view: z.enum(["sheet", "whiteboard", "chat", "info"]).optional()}),
  component: RouteComponent,
  // The puzzle comes with the workspace's state (the layout's loader, so usually cached): its name
  // for the tab's title from there, rather than a request the navigation would wait on. (A
  // failure is the layout's to handle.)
  loader: async ({context: {queryClient}, params: {workspaceSlug, puzzleId}}) => {
    const wire = await queryClient
      .ensureQueryData(workspaceQueryOptions(workspaceSlug))
      .catch(() => undefined);
    return {name: wire && findPuzzle(wire, puzzleId)?.name};
  },
  head: ({loaderData}) => ({meta: [{title: `${loaderData?.name ?? "Puzzle"} | WOW`}]}),
  pendingComponent: PuzzlePageSkeleton,
});

/** The puzzle's Google Sheet, without the editor or preview part. */
const googleFileUrl = (puzzle: {googleSpreadsheetId: string | null}) =>
  `https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}`;

function RouteComponent() {
  const {workspaceSlug, puzzleId} = Route.useParams();
  const puzzle = usePuzzle({puzzleId});
  const navigate = useNavigate();
  // Phones get one view at a time (tabs) instead of side-by-side panels.
  const isWide = useMediaQuery("(min-width: 768px)");

  if (!puzzle.data || !puzzleId) {
    // Unknown or since-deleted puzzle: say so inside the workspace rather than a blank page.
    return <NotFoundPage className="min-h-0" />;
  }

  // Keyed so the form (and chat history) never carry over between puzzles: a touched form stops
  // following its default values, so it would otherwise keep showing, and on the next change
  // submit, the previous puzzle's fields.
  const info = (
    <PuzzleInfoPanel
      key={puzzleId}
      workspaceSlug={workspaceSlug}
      puzzle={puzzle.data}
      shareUrl={window.location.href}
      onDeleted={() => void navigate({to: "/$workspaceSlug", params: {workspaceSlug}})}
    />
  );
  const chat = <Chat key={puzzleId} puzzleId={puzzleId} />;

  if (!isWide) {
    return (
      // min-w-0: as a flex item it would otherwise grow to its widest content, not the screen.
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
          <WorksheetPane puzzle={puzzle.data} phone={{chat, info}} />
        </PresencesWebSocket>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <PresencesWebSocket workspaceSlug={workspaceSlug} puzzleId={puzzleId}>
        <div className="flex flex-1">
          <Resizable orientation="horizontal">
            <Resizable.Panel defaultSize={75} className="flex min-h-0 flex-col">
              <WorksheetPane puzzle={puzzle.data} />
            </Resizable.Panel>
            <Resizable.Handle type="drag" />
            {/* Wide enough for an answer and tags; the info half tall enough for its fields. */}
            <Resizable.Panel defaultSize={25}>
              <Resizable orientation="vertical">
                <Resizable.Panel defaultSize={45} className="flex">
                  {info}
                </Resizable.Panel>
                <Resizable.Handle type="drag" />
                <Resizable.Panel defaultSize={55} className="flex flex-col">
                  {chat}
                </Resizable.Panel>
              </Resizable>
            </Resizable.Panel>
          </Resizable>
        </div>
      </PresencesWebSocket>
    </main>
  );
}

/**
 * Your time on this puzzle, ticking each second while it counts (this tab is in front of you) and
 * dimmed while it's paused. Also what records it (see `usePuzzleTimeTracker`).
 */
function PuzzleTimer({puzzleId}: {puzzleId: string}) {
  const {workspaceSlug} = Route.useParams();
  const {seconds, isCounting} = usePuzzleTimeTracker(workspaceSlug, puzzleId);
  return (
    // At the end of the bar (the tooltip trigger doesn't pass layout classes through).
    <div data-tour="timer" className="ms-auto flex shrink-0">
      <Tooltip delay={300}>
        <Tooltip.Trigger>
          <Chip
            size="sm"
            variant="secondary"
            aria-label={`Your time on this puzzle: ${seconds === undefined ? "loading" : formatPuzzleTime(seconds)}`}
            className={cn("gap-1 tabular-nums transition-opacity", !isCounting && "opacity-60")}>
            <TimerIcon className="size-3.5" />
            <Chip.Label>{seconds === undefined ? "–:––" : formatPuzzleTime(seconds)}</Chip.Label>
          </Chip>
        </Tooltip.Trigger>
        <Tooltip.Content>
          Your time on this puzzle. It counts while this tab is the one in front of you.
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}

/**
 * The puzzle's working surface: its sheet and a shared whiteboard, switched from a tab bar. The
 * sheet is the puzzle's Google Sheet if it has one; otherwise it's the built-in
 * spreadsheet. Both stay mounted once opened, so
 * switching never reloads the sheet; the whiteboard only loads (and connects) when first opened.
 */
function WorksheetPane({
  puzzle,
  phone,
}: {
  puzzle: {
    id: string;
    name: string;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleFileJob: GoogleFileJob | null;
  };
  /** On phones, chat and the details panel become tabs here too. */
  phone?: {chat: ReactNode; info: ReactNode};
}) {
  const navigate = useNavigate({from: Route.fullPath});
  const isReadOnly = useIsReadOnly();
  // A Google Sheet made for this puzzle is shown even if the workspace has since
  // disconnected Drive (it still opens for anyone with access); other puzzles get the built-in one.
  const googleWorksheet = Boolean(puzzle.googleSpreadsheetId);
  const defaultView = "sheet";
  const requested = Route.useSearch().view ?? defaultView;
  // Chat and details are only views on phones; a phone link opened on desktop shows the sheet.
  const view = !phone && (requested === "chat" || requested === "info") ? defaultView : requested;
  // Mount the whiteboard the first time it's shown, then keep it (and its connection) around.
  const [whiteboardOpened, setWhiteboardOpened] = useState(view === "whiteboard");
  if (view === "whiteboard" && !whiteboardOpened) setWhiteboardOpened(true);

  return (
    <>
      <div className="border-separator flex h-10 shrink-0 items-center border-b px-2">
        <Tabs
          selectedKey={view}
          className={cn(phone && "min-w-0 flex-1")}
          onSelectionChange={key => {
            const next = VIEWS.find(v => v === key) ?? "sheet";
            track("puzzle_view_switched", {view: next, phone});
            void navigate({search: prev => ({...prev, view: next}), replace: true});
          }}>
          <Tabs.ListContainer>
            <Tabs.List
              data-tour="puzzle-views"
              aria-label="Puzzle views"
              className={cn(phone ? "w-full" : "w-fit")}>
              <Tabs.Tab id="sheet" className={cn("h-7 px-3 text-xs", phone && "flex-1")}>
                {/* Phones: words only, so all four tabs fit next to the timer. */}
                {!phone && <SheetIcon className="me-1.5 size-3.5" />}
                <span>Sheet</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="whiteboard" className={cn("h-7 px-3 text-xs", phone && "flex-1")}>
                {!phone && <PresentationIcon className="me-1.5 size-3.5" />}
                <span>Whiteboard</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              {phone && (
                <>
                  <Tabs.Tab id="chat" className="h-7 flex-1 px-3 text-xs">
                    <span>Chat</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="info" className="h-7 flex-1 px-3 text-xs">
                    <span>Info</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </>
              )}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <PuzzleTimer puzzleId={puzzle.id} />
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col", view !== "sheet" && "hidden")}>
        {googleWorksheet ? (
          <WorksheetFrame
            // A new puzzle gets a fresh frame (and loading state), and so does archiving.
            key={`${puzzle.id}${isReadOnly ? ":read-only" : ""}`}
            title={`${puzzle.name} spreadsheet`}
            src={
              // Archived: Google's read-only preview, since WOW can't stop edits inside Google's own
              // editor (anyone with access to the file could still change it there).
              isReadOnly
                ? `${googleFileUrl(puzzle)}/preview`
                : `${googleFileUrl(puzzle)}/edit?widget=true&chrome=false&rm=embedded`
            }
            openHref={`${googleFileUrl(puzzle)}/${isReadOnly ? "preview" : "edit"}`}
          />
        ) : puzzle.googleFileJob ? (
          // Its Google file is being made (it appears here once the room has its id), or failed.
          <GoogleFileJobPanel puzzleId={puzzle.id} job={puzzle.googleFileJob} />
        ) : (
          <PuzzleSheet key={puzzle.id} puzzleId={puzzle.id} />
        )}
      </div>
      {whiteboardOpened && (
        <div
          className={cn(
            // Fills exactly what the panel has: a computed height overflowed the page.
            "flex min-h-0 flex-1 flex-col",
            view !== "whiteboard" && "hidden"
          )}>
          <PuzzleWhiteboard puzzleId={puzzle.id} />
        </div>
      )}
      {phone && (
        <>
          {/* Kept mounted (hidden) so chat keeps its connection and unread history. */}
          <div className={cn("flex min-h-0 flex-1 flex-col", view !== "chat" && "hidden")}>
            {phone.chat}
          </div>
          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 overflow-auto",
              view !== "info" && "hidden"
            )}>
            {phone.info}
          </div>
        </>
      )}
    </>
  );
}

const VIEWS = ["sheet", "whiteboard", "chat", "info"] as const;

/** Where the puzzle's Google file will be: being made, or not made, with a way to try again. */
function GoogleFileJobPanel({puzzleId, job}: {puzzleId: string; job: GoogleFileJob}) {
  const {workspaceSlug} = Route.useParams();
  const isReadOnly = useIsReadOnly();
  const what = "Google Sheet";
  const retry = useMutation({
    mutationFn: () => client.puzzles.retrySheet({workspaceSlug, id: puzzleId}),
    // The room broadcasts the job going back to "creating".
    meta: {invalidates: false},
    onError: error => toast.error(errorMessage(error, `Couldn't try again. Please try again.`)),
  });
  if (job.status === "creating") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Spinner aria-label={`Creating the ${what}`} />
        <p className="text-muted text-sm">Creating the {what}…</p>
        <p className="text-muted text-xs">It opens here as soon as it's ready.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium">Couldn't create the {what}</p>
      {job.detail && <p className="text-muted max-w-md text-xs">{job.detail}</p>}
      {!isReadOnly && (
        <Button
          size="sm"
          variant="secondary"
          isPending={retry.isPending}
          onPress={() => retry.mutate()}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Google can be slow to answer; after this long, offer a retry or a new tab. */
const SLOW_SHEET_MS = 15_000;

/**
 * The Google Sheet, with a placeholder until it has loaded (instead of a blank white
 * frame), and a way out if it's slow.
 */
function WorksheetFrame({title, src, openHref}: {title: string; src: string; openHref: string}) {
  // When the current load started (a retry starts a new one, with a fresh frame).
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (loaded) return undefined;
    const timer = setTimeout(() => setSlow(true), startedAt + SLOW_SHEET_MS - Date.now());
    return () => clearTimeout(timer);
  }, [loaded, startedAt]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* oxlint-disable-next-line react/iframe-missing-sandbox -- trusted Google Sheets editor that needs scripts, same-origin storage, popups (sign-in, share) and top navigation; any sandbox would break it. */}
      <iframe
        key={startedAt}
        title={title}
        src={src}
        allow="fullscreen; geolocation; microphone; camera; payment"
        onLoad={() => setLoaded(true)}
        className="h-full w-full flex-1"
      />
      {!loaded && (
        <div className="bg-background absolute inset-0 flex flex-col">
          {/* The sheet's outline (instead of a blank frame or a spinner), and a word on it. */}
          <SheetSkeleton />
          <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-muted bg-background px-2 text-sm">
              {slow ? "Google is taking a while…" : "Loading the sheet…"}
            </p>
            {slow && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    setSlow(false);
                    setStartedAt(Date.now());
                  }}>
                  Retry
                </Button>
                <a
                  href={openHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({size: "sm", variant: "ghost"})}>
                  Open in a new tab
                  <ExternalLinkIcon />
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
