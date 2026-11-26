import type {TourKind, TourState} from "@/lib/tour-state";
import type {WorkspaceRoomState} from "@/lib/workspace-state";

/**
 * The onboarding tours, as data. Each step points at a part of the page (a CSS selector, usually a
 * `data-tour` attribute) and says what it is; "tasks" wait for the person to do something (add a
 * round…) and can be done for them. See tour-provider.tsx for how they're played.
 */

type Puzzle = WorkspaceRoomState["rounds"][number]["puzzles"][number];

/** What steps can look at: the live workspace, and what the tour has made or picked. */
export type TourContext = {
  workspace: WorkspaceRoomState;
  state: TourState;
  isPhone: boolean;
  /** The puzzle page that's open, if any. */
  openPuzzleId: string | null;
  /** The round, meta and puzzle the tour points at (examples it made, or what's on the board). */
  roundId: string | null;
  metaId: string | null;
  puzzleId: string | null;
};

/** Which page a step is on. */
export type TourPage =
  /** Anywhere in the workspace (no page of its own). */
  | "any"
  | "board"
  /** The puzzle the tour picked (any puzzle page will do). */
  | "puzzle"
  /** The meta the tour picked, with its feeders. */
  | "meta";

export type TourTask = {
  /** Done yet? Moves on by itself the moment this turns true. */
  isDone: (ctx: TourContext) => boolean;
  /** What "Do it for me" does (see tour-provider.tsx). */
  doItForMe: "round" | "meta" | "feeders" | "open-puzzle";
};

export type TourStep = {
  id: string;
  page: TourPage;
  /** What to point at; none (or not found) shows the step in the middle of the page. */
  target?: (ctx: TourContext) => string | null | undefined;
  /** Spotlight this ancestor of the target instead (e.g. the whole row around a link). */
  expandTo?: string;
  title: string;
  body: (ctx: TourContext) => React.ReactNode;
  task?: TourTask;
  /** Leave the step out (e.g. a part of the page phones don't have). */
  skip?: (ctx: TourContext) => boolean;
  /** Skip it if its target isn't on the page (rather than showing it in the middle). */
  optional?: boolean;
};

const B = ({children}: {children: React.ReactNode}) => (
  <strong className="text-foreground font-semibold">{children}</strong>
);

export const EXAMPLE_NAMES = {
  round: "Example round",
  meta: "Example meta",
  puzzles: ["Example puzzle 1", "Example puzzle 2"],
} as const;

export const allPuzzles = (workspace: WorkspaceRoomState): Puzzle[] =>
  workspace.rounds.flatMap(round => round.puzzles);

const onPhone = (ctx: TourContext) => ctx.isPhone;
const noPuzzle = (ctx: TourContext) => ctx.puzzleId === null;

// --- Steps both tours share ----------------------------------------------------------------------

const toolbar: TourStep = {
  id: "toolbar",
  page: "board",
  target: () => "[data-tour=board-toolbar]",
  title: "Find puzzles fast",
  body: ctx => (
    <>
      Search by name, answer or tag
      {ctx.isPhone ? null : (
        <>
          {" "}
          (press <B>/</B> to jump here)
        </>
      )}
      . The filters hide solved puzzles, show only your favorites (★ on a row) or one tag. On a big
      board, these are how you find something to work on.
    </>
  ),
};

const workingOn: TourStep = {
  id: "working-on",
  page: "board",
  target: () => "[data-tour=working-on]",
  title: "Who's working on what",
  body: () => (
    <>
      Everyone with a puzzle open shows up on its row, live. Look here before starting a puzzle to
      join the people already on it, or to find one nobody has touched.
    </>
  ),
  skip: onPhone,
};

const teamChat: TourStep = {
  id: "team-chat",
  page: "board",
  target: ctx => (ctx.isPhone ? "[data-tour=team-chat-button]" : "[data-tour=team-chat]"),
  title: "Team chat and the lobby call",
  body: ctx => (
    <>
      The team chat is for the whole team: who's free, lunch, big news. Above it is the{" "}
      <B>lobby call</B>: <B>Listen in</B> to hear everyone, <B>Unmute and talk here</B> to speak.
      {ctx.isPhone ? " Tap this button to open it." : ""} Every puzzle has its own chat and call
      too.
    </>
  ),
};

const headerTools: TourStep = {
  id: "header-tools",
  page: "any",
  target: () => "[data-tour=lobby]",
  title: "Up here: calls, alerts and answers",
  body: () => (
    <>
      The <B>headphones</B> join the lobby call from anywhere. Next to them, the <B>bell</B> keeps
      solves, announcements and @mentions, and the <B>guess queue</B> appears when someone lines up
      an answer to call in. Press <B>⌘K</B> (Ctrl K) to jump to any puzzle or page.
    </>
  ),
};

const openPuzzle: TourStep = {
  id: "open-puzzle",
  page: "board",
  target: ctx => ctx.puzzleId && `[data-tour=puzzle-link][data-tour-id="${ctx.puzzleId}"]`,
  title: "Open a puzzle",
  body: ctx => {
    const name = allPuzzles(ctx.workspace).find(p => p.id === ctx.puzzleId)?.name;
    return (
      <>
        Click {name ? <B>{name}</B> : "a puzzle's name"} to open its page, where the solving
        happens.
      </>
    );
  },
  task: {isDone: ctx => ctx.openPuzzleId !== null, doItForMe: "open-puzzle"},
  skip: noPuzzle,
};

const puzzleViews: TourStep = {
  id: "puzzle-views",
  page: "puzzle",
  target: () => "[data-tour=puzzle-views]",
  title: "A sheet and a whiteboard, shared",
  body: ctx => (
    <>
      Every puzzle gets a spreadsheet everyone edits at once (you see each other's cursors) and a
      whiteboard for drawing things out.
      {ctx.isPhone ? (
        <>
          {" "}
          On a phone, <B>Chat</B> and <B>Info</B> are tabs here too.
        </>
      ) : null}
    </>
  ),
  skip: noPuzzle,
};

const puzzleTools: TourStep = {
  id: "puzzle-tools",
  page: "puzzle",
  target: () => '[aria-label="Puzzle tools"]',
  title: "Formulas made for puzzles",
  body: () => (
    <>
      <B>Puzzle tools</B> lists the sheet's puzzle formulas (letter indexing, anagrams, word
      matching, ciphers) and inserts an example into the selected cell.
    </>
  ),
  skip: noPuzzle,
  optional: true,
};

const puzzleInfo: TourStep = {
  id: "puzzle-info",
  page: "puzzle",
  target: () => "[data-tour=puzzle-info]",
  title: "Answer and status",
  body: () => (
    <>
      Type the answer here once it's confirmed: the puzzle is marked <B>Solved</B> and everyone gets
      a notification. Until then, set its <B>status</B> (Extraction, Stuck, Needs eyes…) so the team
      can see how it's going from the board.
    </>
  ),
  skip: ctx => noPuzzle(ctx) || ctx.isPhone,
};

const iHelped: TourStep = {
  id: "i-helped",
  page: "puzzle",
  target: () => "[data-tour=i-helped]",
  title: "Take credit",
  body: () => (
    <>
      Worked on this one? Press <B>I helped</B>. It counts towards your stats and the leaderboard's
      awards, which no one can work out from who typed the answer.
    </>
  ),
  skip: ctx => noPuzzle(ctx) || ctx.isPhone,
  optional: true,
};

const guesses: TourStep = {
  id: "guesses",
  page: "puzzle",
  target: () => "section[aria-label=Guesses]",
  title: "The guess queue",
  body: () => (
    <>
      Got an answer to try? Open <B>Guesses</B> and add it. Whoever is calling answers in sees every
      queued guess, records what the hunt said, and can wait out a backoff, so nobody repeats a
      wrong guess.
    </>
  ),
  skip: ctx => noPuzzle(ctx) || ctx.isPhone,
  optional: true,
};

const puzzleVoice: TourStep = {
  id: "puzzle-voice",
  page: "puzzle",
  target: () => "[data-tour=voice-strip]",
  title: "Talk it through",
  body: () => (
    <>
      Here's who's on this puzzle, and its call. <B>Listen in</B> to hear them, then{" "}
      <B>Unmute and talk here</B> to join in. You stay in the call as you move around the workspace,
      until you leave it.
    </>
  ),
  skip: ctx => noPuzzle(ctx) || ctx.isPhone,
  optional: true,
};

const timer: TourStep = {
  id: "timer",
  page: "puzzle",
  target: () => "[data-tour=timer]",
  title: "Your time on it",
  body: () => (
    <>
      This counts your time on the puzzle while its tab is in front of you. It feeds your stats, and
      it's a nudge to take a break or swap puzzles when you've been stuck a while.
    </>
  ),
  skip: noPuzzle,
};

const wrapUp = (kind: TourKind): TourStep => ({
  id: "done",
  page: "any",
  target: ctx => (ctx.isPhone ? undefined : "[data-tour=sections]"),
  title: "You're all set",
  body: ctx => {
    // The examples "Do it for me" made that are still on the board.
    const {roundId, metaId, puzzleIds = []} = ctx.state.examples ?? {};
    const exampleIds = new Set([roundId, metaId, ...puzzleIds]);
    const examples = [
      ...ctx.workspace.rounds.filter(round => exampleIds.has(round.id)),
      ...allPuzzles(ctx.workspace).filter(puzzle => exampleIds.has(puzzle.id)),
    ].map(item => item.name);
    return (
      <>
        These tabs lead to the <B>Leaderboard</B>, the <B>Activity log</B>,{" "}
        {kind === "captain" ? (
          <>
            <B>Settings</B> (copy the invitation link for your team, connect Google Drive or
            Discord){" "}
          </>
        ) : (
          <>
            <B>Settings</B>{" "}
          </>
        )}
        and <B>Help</B>, where you can take this tour again.
        {examples.length > 0 ? (
          <>
            {" "}
            When you're ready, rename or delete the examples ({examples.join(", ")}) from their row
            menus.
          </>
        ) : null}{" "}
        Happy hunting!
      </>
    );
  },
});

// --- The captain's tour: setting up, then everything else ---------------------------------------

const CAPTAIN: TourStep[] = [
  {
    id: "welcome",
    page: "any",
    title: "Welcome to your workspace",
    body: () => (
      <>
        Here's a 3-minute tour: you'll add a round, a meta and a puzzle, look around a puzzle page,
        and see how calls and the guess queue work. You can do each step yourself, or have it done
        for you.
      </>
    ),
  },
  {
    id: "add-round",
    page: "board",
    target: ctx =>
      ctx.workspace.rounds.length === 0 ? "[data-tour=add-first-round]" : "[data-tour=add-round]",
    title: "Add a round",
    body: ctx =>
      ctx.workspace.rounds.length === 0 ? (
        <>
          Hunts unlock puzzles in rounds. Click <B>Add a round</B> and give it the round's name.
          (Later, it's the <B>+</B> at the right end of the board's header row.)
        </>
      ) : (
        <>
          Hunts unlock puzzles in rounds. Click the <B>+</B> at the right end of the board's header
          row.
        </>
      ),
    task: {isDone: ctx => ctx.workspace.rounds.length > 0, doItForMe: "round"},
  },
  {
    id: "add-meta",
    page: "board",
    target: ctx => ctx.roundId && `[data-tour=round-menu][data-tour-id="${ctx.roundId}"]`,
    title: "Add a meta",
    body: () => (
      <>
        A round's <B>meta</B> is the puzzle its other puzzles' answers feed into. Click this round's{" "}
        <B>⋯</B>, then <B>Add a meta</B>.
      </>
    ),
    task: {isDone: ctx => allPuzzles(ctx.workspace).some(p => p.isMetaPuzzle), doItForMe: "meta"},
  },
  {
    id: "add-feeder",
    page: "board",
    target: ctx => ctx.metaId && `[data-tour=meta-menu][data-tour-id="${ctx.metaId}"]`,
    title: "Add a puzzle",
    body: () => (
      <>
        Now a puzzle that feeds the meta: click the meta's <B>⋯</B>, then <B>Add a feeder</B>. Paste
        the puzzle's link from the hunt site so everyone can open it in one click.
      </>
    ),
    task: {
      isDone: ctx => allPuzzles(ctx.workspace).some(p => !p.isMetaPuzzle && p.parentPuzzleId),
      doItForMe: "feeders",
    },
  },
  {
    id: "row",
    page: "board",
    target: ctx => ctx.puzzleId && `[data-tour=puzzle-link][data-tour-id="${ctx.puzzleId}"]`,
    expandTo: "[role=row]",
    title: "Each puzzle is a row",
    body: ctx => (
      <>
        Change the answer, <B>status</B>
        {ctx.isPhone ? "" : ", importance and tags"} right here; everyone sees it instantly. Feeders
        sit under their meta. To reorder rounds and puzzles, or move a puzzle to another meta, use{" "}
        <B>Arrange</B>.
      </>
    ),
    skip: noPuzzle,
  },
  toolbar,
  workingOn,
  {
    id: "sidebar",
    page: "board",
    target: ctx => (ctx.isPhone ? "[data-tour=sidebar-button]" : "[data-tour=sidebar]"),
    title: "Notes, progress and announcements",
    body: ctx => (
      <>
        The <B>notes</B> are for the whole team: who's calling in answers, the plan, where to meet.
        Under them, each round's puzzles are squares coloured by status. The <B>megaphone</B> sends
        an announcement that pops up for everyone.
        {ctx.isPhone ? " On a phone they're behind this button." : ""}
      </>
    ),
  },
  teamChat,
  {
    id: "sections",
    page: "any",
    target: () => "[data-tour=sections]",
    title: "The rest of the workspace",
    body: () => (
      <>
        These tabs switch between the blackboard, the <B>Leaderboard</B>, the <B>Activity log</B>,{" "}
        <B>Settings</B> and <B>Help</B>. The puzzle you last opened sits at the end, one click away.
      </>
    ),
    skip: onPhone,
  },
  headerTools,
  openPuzzle,
  puzzleViews,
  puzzleTools,
  puzzleInfo,
  iHelped,
  guesses,
  puzzleVoice,
  timer,
  {
    id: "meta-row",
    page: "board",
    target: ctx => ctx.metaId && `[data-tour=puzzle-link][data-tour-id="${ctx.metaId}"]`,
    expandTo: "[role=row]",
    title: "How metas work",
    body: () => (
      <>
        Back on the board: a meta's feeders are listed under it. As feeders are solved, their
        answers collect on the meta's page, ready to use. Let's look.
      </>
    ),
    skip: ctx => ctx.metaId === null,
  },
  {
    id: "feeder-answers",
    page: "meta",
    target: () => "section[aria-label='Feeder answers']",
    title: "Feeder answers",
    body: () => (
      <>
        Every feeder's answer, as they come in. <B>Copy table</B> copies them (name, answer) to
        paste into the sheet, ready for extraction. A feeder's page shows its siblings the same way.
      </>
    ),
    skip: ctx => ctx.metaId === null,
    optional: true,
  },
  wrapUp("captain"),
];

// --- The solver's tour: finding your way around (nothing to set up) ------------------------------

const SOLVER: TourStep[] = [
  {
    id: "welcome",
    page: "any",
    title: "Welcome to the team's workspace",
    body: () => (
      <>A 2-minute tour of where things are: the board, a puzzle page, calls and the guess queue.</>
    ),
  },
  {
    id: "board",
    page: "board",
    target: ctx =>
      ctx.workspace.rounds.length > 0 ? "[data-tour=board]" : "[data-tour=add-first-round]",
    title: "The blackboard",
    body: () => (
      <>
        Every round, meta and puzzle, with its answer and <B>status</B>. Feeders sit under their
        meta. Edit any of it right here; everyone sees it instantly.
      </>
    ),
  },
  toolbar,
  workingOn,
  teamChat,
  headerTools,
  openPuzzle,
  puzzleViews,
  puzzleTools,
  puzzleInfo,
  iHelped,
  guesses,
  puzzleVoice,
  timer,
  wrapUp("solver"),
];

export const TOURS: Record<TourKind, TourStep[]> = {captain: CAPTAIN, solver: SOLVER};
