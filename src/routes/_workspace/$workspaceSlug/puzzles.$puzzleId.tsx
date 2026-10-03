import {EmptyState} from "@heroui-pro/react";
import {Resizable} from "@heroui-pro/react/resizable";
import {Button, buttonVariants, InputGroup, ListBox, Spinner, Tabs, Tooltip} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {createFileRoute, Link, useNavigate} from "@tanstack/react-router";
import {
  BrushIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EditIcon,
  ExternalLinkIcon,
  InfoIcon,
  MessagesSquareIcon,
  PresentationIcon,
  PuzzleIcon,
  SheetIcon,
  TableIcon,
} from "lucide-react";
import {type ReactNode, useEffect, useState} from "react";
import {cn} from "tailwind-variants";
import {useMediaQuery} from "usehooks-ts";
import {z} from "zod";

import {Chat} from "@/components/chat";
import {CommentBox} from "@/components/comment-box";
import {EditPuzzleDialog} from "@/components/edit-puzzle-dialog";
import {useAppForm} from "@/components/form";
import {NotFoundPage} from "@/components/not-found-page";
import {PresencesWebSocket} from "@/components/presences-websocket";
import {SolveSpark} from "@/components/solve-spark";
import {PuzzleWhiteboard} from "@/components/whiteboard/whiteboard";
import {useWorkspace} from "@/hooks/use-workspace";
import {client} from "@/lib/orpc";
import {getPuzzleImportances} from "@/lib/puzzleImportances";
import {
  getBgColorClassNamesForPuzzleStatusNoHover,
  getPuzzleStatusGroups,
  getPuzzleStatusOptions,
} from "@/lib/puzzleStatuses";
import {usePuzzle} from "@/lib/usePuzzle";
import {workspaceMutations} from "@/lib/workspace-mutations";

export const Route = createFileRoute("/_workspace/$workspaceSlug/puzzles/$puzzleId")({
  // Which surface the left pane shows; in the URL so a shared link opens the same view.
  // On phones, chat and the puzzle's details are views too (on desktop they're always shown).
  validateSearch: z.object({view: z.enum(["sheet", "whiteboard", "chat", "info"]).optional()}),
  component: RouteComponent,
  head: async ({params}) => {
    const puzzle = await client.puzzles.get({
      workspaceSlug: params.workspaceSlug,
      puzzleId: params.puzzleId,
    });
    return {meta: [{title: `${puzzle.name} | WOW`}]};
  },
});

function RouteComponent() {
  const {workspaceSlug, puzzleId} = Route.useParams();
  const puzzle = usePuzzle({puzzleId});
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
    <PuzzleInfoPanel key={puzzleId} workspaceSlug={workspaceSlug} puzzle={puzzle.data} />
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
            <Resizable.Panel defaultSize={80} className="flex min-h-0 flex-col">
              <WorksheetPane puzzle={puzzle.data} />
            </Resizable.Panel>
            <Resizable.Handle type="drag" />
            <Resizable.Panel defaultSize={20}>
              <Resizable orientation="vertical">
                <Resizable.Panel defaultSize={30} className="flex">
                  {info}
                </Resizable.Panel>
                <Resizable.Handle type="drag" />
                <Resizable.Panel defaultSize={60} className="flex flex-col">
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

function PuzzleInfoPanel({
  workspaceSlug,
  puzzle,
}: {
  workspaceSlug: string;
  puzzle: {
    comment: string | null;
    commentUpdatedAt: Date | null;
    commentUpdatedBy: string | null;
    id: string;
    roundId: string;
    parentPuzzleId: string | null;
    name: string;
    link: string | null;
    googleSpreadsheetId: string | null;
    googleDrawingId: string | null;
    answer: string | null;
    status: string | null;
    importance: string | null;
    childPuzzles: {id: string; answer: string | null; name: string}[];
    isMetaPuzzle: boolean;
    tags: string[];
  };
}) {
  const workspace = useWorkspace();
  const puzzleUpdateMutation = useMutation(workspaceMutations.puzzles.update());
  // Each field commits as soon as it's edited. In between, the form is reset (untouched) so it
  // keeps following `puzzle` — this change's overlay, then the server and other solvers' edits —
  // and only a field that is actually being typed into holds on to its own value.
  const form = useAppForm({
    defaultValues: {
      answer: puzzle.answer ?? "",
      // React Aria collection keys can't be null, so the "None" status option uses "".
      status: puzzle.status ?? "",
      importance: puzzle.importance,
      tags: puzzle.tags,
    },
    onSubmit: ({value}) => {
      puzzleUpdateMutation.mutate({
        workspaceSlug,
        id: puzzle.id,
        answer: value.answer,
        status: value.status || null,
        importance: value.importance,
        tags: value.tags,
      });
      form.reset(value);
    },
  });

  const [isEditPuzzleDialogOpen, setIsEditPuzzleDialogOpen] = useState(false);
  // A feeder's siblings: the meta's other feeders, with their answers so far.
  const meta = puzzle.parentPuzzleId
    ? workspace.rounds.flatMap(r => r.puzzles).find(p => p.id === puzzle.parentPuzzleId)
    : undefined;
  const siblings = meta?.childPuzzles.filter(child => child.id !== puzzle.id) ?? [];

  return (
    <div className="bg-surface flex min-w-0 flex-1 flex-col overflow-auto">
      <div className="border-separator flex items-center gap-1 border-b py-1.5 ps-3 pe-1.5">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={puzzle.name}>
          {puzzle.name}
        </h2>
        {puzzle.link && (
          <PanelLink href={puzzle.link} label="Open on the hunt site" icon={<PuzzleIcon />} />
        )}
        {puzzle.googleSpreadsheetId && (
          <PanelLink
            href={`https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit`}
            label="Open spreadsheet in a new tab"
            icon={<TableIcon />}
          />
        )}
        {puzzle.googleDrawingId && (
          <PanelLink
            href={`https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit`}
            label="Open drawing in a new tab"
            icon={<BrushIcon />}
          />
        )}
        <EditPuzzleDialog
          workspaceSlug={workspaceSlug}
          puzzle={puzzle}
          open={isEditPuzzleDialogOpen}
          setOpen={setIsEditPuzzleDialogOpen}>
          <Button size="sm" isIconOnly variant="ghost" aria-label="Edit puzzle">
            <EditIcon />
          </Button>
        </EditPuzzleDialog>
      </div>
      <PuzzleContext workspaceSlug={workspaceSlug} puzzle={puzzle} />
      <form.AppForm>
        {/* A property list: muted labels on the left, full-width controls on the right. */}
        <form.Form className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3">
          <span className="text-muted text-xs">Answer</span>
          <form.AppField
            name="answer"
            listeners={{
              onBlur: async ({fieldApi}) => {
                // onBlur is called whenever focus is lost. Only actually submit the form if the
                // field value changed. (A missing answer is shown as "", so compare against
                // that: otherwise tabbing through an empty answer marks the puzzle solved.)
                if (fieldApi.state.value === (puzzle.answer ?? "")) {
                  // Blurring marks the field touched; untouch it so it follows `puzzle` again.
                  form.reset();
                  return;
                }
                if (form.state.isValid) {
                  const currentStatus = form.getFieldValue("status");
                  if (
                    fieldApi.state.value !== "" &&
                    currentStatus !== "solved" &&
                    currentStatus !== "backsolved"
                  ) {
                    form.setFieldValue("status", "solved");
                  }

                  await form.handleSubmit();
                }
              },
            }}
            children={field => (
              <div className="min-w-0">
                <InputGroup fullWidth variant="secondary">
                  <field.InputGroupInputField
                    aria-label="Answer"
                    placeholder="Not solved yet"
                    className="font-mono whitespace-pre uppercase placeholder:font-sans placeholder:normal-case"
                    onKeyDown={e => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                </InputGroup>
              </div>
            )}
          />
          <span className="text-muted text-xs">Status</span>
          <form.AppField
            name="status"
            listeners={{
              onChange: async ({fieldApi}) => {
                if (fieldApi.state.value !== "solved" && fieldApi.state.value !== "backsolved") {
                  form.setFieldValue("answer", "");
                }

                if (form.state.isValid) {
                  await form.handleSubmit();
                }
              },
            }}
            children={field => (
              <SolveSpark
                isSolved={field.state.value === "solved" || field.state.value === "backsolved"}>
                <field.SelectField
                  aria-label="Status"
                  variant="secondary"
                  fullWidth
                  placeholder="None"
                  // The trigger carries the status colour, as rows do on the blackboard.
                  className={getBgColorClassNamesForPuzzleStatusNoHover(field.state.value || null)}
                  items={getPuzzleStatusOptions()}>
                  {getPuzzleStatusGroups().map(group => (
                    <ListBox.Section key={group.groupLabel} className={group.bgColorNoHover}>
                      {group.values.map(option => (
                        <ListBox.Item
                          key={option.value ?? ""}
                          id={option.value ?? ""}
                          textValue={option.label}>
                          {option.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox.Section>
                  ))}
                </field.SelectField>
              </SolveSpark>
            )}
          />
          <span className="text-muted text-xs">Importance</span>
          <form.AppField
            name="importance"
            listeners={{
              onChange: async () => {
                if (form.state.isValid) {
                  await form.handleSubmit();
                }
              },
            }}
            children={field => (
              <div className="min-w-0">
                <field.SelectField
                  aria-label="Importance"
                  variant="secondary"
                  fullWidth
                  placeholder="Not set"
                  items={getPuzzleImportances()}>
                  {getPuzzleImportances().map(importance => (
                    <ListBox.Item
                      key={importance.value}
                      id={importance.value}
                      textValue={importance.label}
                      className={importance.color}>
                      <span className="flex items-center gap-2 [&_svg]:size-4">
                        {importance.icon}
                        {importance.label}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </field.SelectField>
              </div>
            )}
          />
          <span className="text-muted self-start pt-2 text-xs">Tags</span>
          <form.AppField
            name="tags"
            listeners={{
              onChange: async () => {
                if (form.state.isValid) {
                  await form.handleSubmit();
                }
              },
            }}
            children={field => (
              <div className="min-w-0">
                <field.ComboboxMultipleField
                  variant="secondary"
                  className="w-full"
                  items={workspace.tags}
                />
              </div>
            )}
          />
        </form.Form>
      </form.AppForm>
      {puzzle.childPuzzles.length > 0 && (
        <PuzzleList
          workspaceSlug={workspaceSlug}
          title="Feeder answers"
          puzzles={puzzle.childPuzzles}
        />
      )}
      {siblings.length > 0 && (
        <PuzzleList workspaceSlug={workspaceSlug} title="Other feeders" puzzles={siblings} />
      )}
      <div className="border-separator border-t p-3">
        <CommentBox
          comment={puzzle.comment}
          commentUpdatedAt={puzzle.commentUpdatedAt}
          commentUpdatedBy={puzzle.commentUpdatedBy}
          workspaceSlug={workspaceSlug}
          puzzleId={puzzle.id}
        />
      </div>
    </div>
  );
}

/** Where the puzzle sits: its round and (for a feeder) its meta, as links. */
function PuzzleContext({
  workspaceSlug,
  puzzle,
}: {
  workspaceSlug: string;
  puzzle: {roundId: string; parentPuzzleId: string | null};
}) {
  const workspace = useWorkspace();
  const round = workspace.rounds.find(r => r.id === puzzle.roundId);
  const meta = puzzle.parentPuzzleId
    ? round?.puzzles.find(p => p.id === puzzle.parentPuzzleId)
    : undefined;
  if (!round) return null;
  return (
    <nav
      aria-label="Puzzle location"
      className="text-muted flex min-w-0 items-center gap-1 px-3 pt-2 text-xs">
      <Link
        to="/$workspaceSlug"
        params={{workspaceSlug}}
        hash={round.id}
        className="hover:text-foreground min-w-0 truncate">
        {round.name}
      </Link>
      {meta && (
        <>
          <ChevronRightIcon className="size-3 shrink-0" aria-hidden />
          <Link
            to="/$workspaceSlug/puzzles/$puzzleId"
            params={{workspaceSlug, puzzleId: meta.id}}
            className="hover:text-foreground min-w-0 truncate">
            {meta.name}
          </Link>
        </>
      )}
    </nav>
  );
}

/** A list of puzzles with their answers (a meta's feeders, a feeder's siblings), as links. */
function PuzzleList({
  workspaceSlug,
  title,
  puzzles,
}: {
  workspaceSlug: string;
  title: string;
  puzzles: {id: string; name: string; answer: string | null}[];
}) {
  return (
    <section className="border-separator flex flex-col gap-1.5 border-t p-3" aria-label={title}>
      <h3 className="text-muted text-xs font-medium">{title}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {puzzles.map(child => (
          <li key={child.id} className="flex items-baseline justify-between gap-3">
            <Link
              to="/$workspaceSlug/puzzles/$puzzleId"
              params={{workspaceSlug, puzzleId: child.id}}
              className="min-w-0 truncate hover:underline">
              {child.name}
            </Link>
            <span
              className={cn(
                "shrink-0 font-mono text-xs",
                child.answer ? "text-success" : "text-muted"
              )}>
              {child.answer ? child.answer.toUpperCase() : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Previous/next puzzle (in board order), keeping the current view. */
function PuzzleStepper({puzzleId}: {puzzleId: string}) {
  const workspace = useWorkspace();
  const navigate = useNavigate({from: Route.fullPath});
  const all = workspace.rounds.flatMap(round => round.puzzles);
  const index = all.findIndex(p => p.id === puzzleId);
  const previous = index > 0 ? all[index - 1] : undefined;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : undefined;
  const go = (id: string) =>
    void navigate({
      to: "/$workspaceSlug/puzzles/$puzzleId",
      params: prev => ({...prev, puzzleId: id}),
      search: prev => prev,
    });
  return (
    <div className="ms-auto flex shrink-0 items-center">
      {[
        {target: previous, label: "Previous puzzle", Icon: ChevronLeftIcon},
        {target: next, label: "Next puzzle", Icon: ChevronRightIcon},
      ].map(({target, label, Icon}) => (
        <Tooltip key={label} delay={300}>
          <Tooltip.Trigger>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              isDisabled={!target}
              aria-label={target ? `${label}: ${target.name}` : label}
              onPress={() => target && go(target.id)}>
              <Icon />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            {target ? `${label}: ${target.name}` : `No ${label.toLowerCase()}`}
          </Tooltip.Content>
        </Tooltip>
      ))}
    </div>
  );
}

/** An icon-only link in the panel header, labelled by a tooltip. */
function PanelLink({href, label, icon}: {href: string; label: string; icon: React.ReactNode}) {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <a
          aria-label={label}
          className={buttonVariants({variant: "ghost", size: "sm", isIconOnly: true})}
          href={href}
          target="_blank"
          rel="noopener noreferrer">
          {icon}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The puzzle's working surface: its Google sheet (or drawing) and a shared whiteboard, switched
 * from a tab bar. Both stay mounted once opened, so switching never reloads the sheet; the
 * whiteboard only loads (and connects) when it's first opened.
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
    googleDrawingId: string | null;
  };
  /** On phones, chat and the details panel become tabs here too. */
  phone?: {chat: ReactNode; info: ReactNode};
}) {
  const navigate = useNavigate({from: Route.fullPath});
  const hasWorksheet = Boolean(puzzle.googleSpreadsheetId || puzzle.googleDrawingId);
  // Without a Google worksheet, the whiteboard is the useful default.
  const defaultView = hasWorksheet ? "sheet" : "whiteboard";
  const requested = Route.useSearch().view ?? defaultView;
  // Chat and details are only views on phones; a phone link opened on desktop shows the sheet.
  const view = !phone && (requested === "chat" || requested === "info") ? defaultView : requested;
  // Mount the whiteboard the first time it's shown, then keep it (and its connection) around.
  const [whiteboardOpened, setWhiteboardOpened] = useState(view === "whiteboard");
  if (view === "whiteboard" && !whiteboardOpened) setWhiteboardOpened(true);
  const sheetLabel = puzzle.googleDrawingId && !puzzle.googleSpreadsheetId ? "Drawing" : "Sheet";

  return (
    <>
      <div className="border-separator flex h-10 shrink-0 items-center border-b px-2">
        <Tabs
          selectedKey={view}
          className={cn(phone && "w-full")}
          onSelectionChange={key =>
            void navigate({
              search: prev => ({...prev, view: VIEWS.find(v => v === key) ?? "sheet"}),
              replace: true,
            })
          }>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Puzzle views" className={cn(phone ? "w-full" : "w-fit")}>
              <Tabs.Tab id="sheet" className={cn("h-7 px-3 text-xs", phone && "flex-1")}>
                <SheetIcon className="size-3.5" />
                <span className="ms-1.5">{sheetLabel}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="whiteboard" className={cn("h-7 px-3 text-xs", phone && "flex-1")}>
                <PresentationIcon className="size-3.5" />
                <span className="ms-1.5">{phone ? "Draw" : "Whiteboard"}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
              {phone && (
                <>
                  <Tabs.Tab id="chat" className="h-7 flex-1 px-3 text-xs">
                    <MessagesSquareIcon className="size-3.5" />
                    <span className="ms-1.5">Chat</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="info" className="h-7 flex-1 px-3 text-xs">
                    <InfoIcon className="size-3.5" />
                    <span className="ms-1.5">Info</span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </>
              )}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        {!phone && <PuzzleStepper puzzleId={puzzle.id} />}
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col", view !== "sheet" && "hidden")}>
        {hasWorksheet ? (
          <WorksheetFrame
            // A new puzzle gets a fresh frame (and loading state).
            key={puzzle.id}
            title={`${puzzle.name} ${puzzle.googleSpreadsheetId ? "spreadsheet" : "drawing"}`}
            src={
              puzzle.googleSpreadsheetId
                ? `https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit?widget=true&chrome=false&rm=embedded`
                : `https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit?widget=true&chrome=false&rm=embedded`
            }
            openHref={
              puzzle.googleSpreadsheetId
                ? `https://docs.google.com/spreadsheets/d/${puzzle.googleSpreadsheetId}/edit`
                : `https://docs.google.com/drawings/d/${puzzle.googleDrawingId}/edit`
            }
          />
        ) : (
          // No worksheet (e.g. Google Drive isn't connected): the page still has the whiteboard,
          // chat, answer and status, so say so rather than embedding a broken frame.
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <SheetIcon />
                </EmptyState.Media>
                <EmptyState.Title>No spreadsheet for this puzzle</EmptyState.Title>
                <EmptyState.Description>
                  Connect Google Drive in the workspace settings to get a sheet for new puzzles. The
                  whiteboard, chat and answer work without one.
                </EmptyState.Description>
              </EmptyState.Header>
              {puzzle.link && (
                <EmptyState.Content>
                  <a
                    href={puzzle.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({variant: "secondary"})}>
                    Open the puzzle on the hunt site
                    <ExternalLinkIcon />
                  </a>
                </EmptyState.Content>
              )}
            </EmptyState>
          </div>
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

/** Google can be slow to answer; after this long, offer a retry or a new tab. */
const SLOW_SHEET_MS = 15_000;

/**
 * The Google Sheet/Drawing, with a placeholder until it has loaded (instead of a blank white
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
      {/* oxlint-disable-next-line react/iframe-missing-sandbox -- trusted Google Sheets/Drawings editor that needs scripts, same-origin storage, popups (sign-in, share) and top navigation; any sandbox would break it. */}
      <iframe
        key={startedAt}
        title={title}
        src={src}
        allow="fullscreen; geolocation; microphone; camera; payment"
        onLoad={() => setLoaded(true)}
        className="h-full w-full flex-1 bg-white"
      />
      {!loaded && (
        <div className="bg-surface absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Spinner aria-label="Loading the sheet" />
          <p className="text-muted text-sm">
            {slow ? "Google is taking its time…" : "Unfolding the sheet…"}
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
      )}
    </div>
  );
}
