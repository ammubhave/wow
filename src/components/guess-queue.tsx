import {
  Badge,
  Button,
  Chip,
  Dropdown,
  Input,
  Label,
  Popover,
  Separator,
  TextField,
} from "@heroui/react";
import {useMutation} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronRightIcon,
  EllipsisIcon,
  HourglassIcon,
  ListOrderedIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {useEffect, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {HelpLink} from "@/docs/components/help-link";
import {useWorkspace} from "@/hooks/use-workspace";
import {joinAnswers, normalizeAnswer, splitAnswers} from "@/lib/answers";
import {orpc} from "@/lib/orpc";
import {workspaceMutations} from "@/lib/workspace-mutations";
import type {WorkspaceRoomState} from "@/server/do/workspace";

type Guess = WorkspaceRoomState["guesses"][number];
type Status = "queued" | "submitted" | "correct" | "incorrect" | "partial" | "withdrawn";

const STATUS: Record<
  Status,
  {label: string; color: "default" | "accent" | "success" | "danger" | "warning"}
> = {
  queued: {label: "Queued", color: "default"},
  submitted: {label: "Submitted", color: "accent"},
  correct: {label: "Correct", color: "success"},
  incorrect: {label: "Wrong", color: "danger"},
  partial: {label: "Keep going", color: "warning"},
  withdrawn: {label: "Withdrawn", color: "default"},
};
const isStatus = (value: string): value is Status => value in STATUS;
const statusOf = (guess: Guess): Status => (isStatus(guess.status) ? guess.status : "queued");

/** Still to be dealt with: waiting to be called in, or called in and waiting on the hunt. */
export const isPending = (guess: Guess) =>
  guess.status === "queued" || guess.status === "submitted";

/** Backoffs people pick from (minutes). */
const WAITS = [1, 2, 5, 10, 15, 30, 60];

const SECOND_MS = 1000;
/** The live data sends dates as strings over the socket (Dates on first load). */
const ms = (date: Date | string | null) => (date === null ? null : new Date(date).getTime());

/** Now, ticking each second while any of these guesses is waiting out a backoff. */
function useNow(guesses: Guess[]) {
  const [now, setNow] = useState(() => Date.now());
  const waiting = guesses.some(g => isPending(g) && (ms(g.retryAt) ?? 0) > now);
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [waiting]);
  return now;
}

function countdown(left: number) {
  const s = Math.ceil(left / SECOND_MS);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

const timeAgo = (at: Date | string, now: number) => {
  const minutes = Math.round((now - (ms(at) ?? now)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};

/** Recording a verdict, and for a correct one, putting the answer on the puzzle too. */
function useGuessActions(workspaceSlug: string) {
  const workspace = useWorkspace();
  const {mutate: updateGuess} = useMutation(orpc.guesses.update.mutationOptions());
  const {mutate: updatePuzzle} = useMutation(workspaceMutations.puzzles.update());
  const set = (guess: Guess, change: {status?: Status; retryAt?: number | null}) =>
    updateGuess(
      {workspaceSlug, id: guess.id, ...change},
      {onError: () => toast.error("Couldn't update that guess.")}
    );
  const markCorrect = (guess: Guess) => {
    const puzzle = workspace.rounds.flatMap(r => r.puzzles).find(p => p.id === guess.puzzleId);
    set(guess, {status: "correct", retryAt: null});
    if (!puzzle) return;
    // One answer: this is it. Several: add it to those found so far (once).
    const found = splitAnswers(puzzle.answer);
    const answers =
      puzzle.answerCount <= 1
        ? [guess.answer]
        : found.some(a => normalizeAnswer(a) === normalizeAnswer(guess.answer))
          ? found
          : [...found, guess.answer];
    const isComplete = answers.length >= puzzle.answerCount;
    const isSolved = puzzle.status === "solved" || puzzle.status === "backsolved";
    updatePuzzle({
      workspaceSlug,
      id: puzzle.id,
      answer: joinAnswers(answers),
      ...(isComplete && !isSolved ? {status: "solved"} : {}),
    });
  };
  return {set, markCorrect};
}

/** A guess: its answer, where it stands, and what to do next. */
function GuessRow({
  guess,
  workspaceSlug,
  now,
  puzzleName,
}: {
  guess: Guess;
  workspaceSlug: string;
  now: number;
  /** Shown (as a link) in the workspace-wide queue. */
  puzzleName?: string;
}) {
  const {set, markCorrect} = useGuessActions(workspaceSlug);
  const status = statusOf(guess);
  const retryAt = ms(guess.retryAt);
  const waitLeft = isPending(guess) && retryAt !== null ? retryAt - now : 0;
  return (
    // Two lines, so the guess itself keeps the full width (the side panel is narrow): the guess
    // and where it stands, then who and when, with what to do next.
    <li className="flex min-w-0 flex-col gap-1 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-mono text-sm font-semibold break-all uppercase",
            status === "withdrawn" && "text-muted line-through",
            status === "incorrect" && "text-muted"
          )}>
          {guess.answer}
        </span>
        <Chip size="sm" variant="soft" color={STATUS[status].color}>
          {STATUS[status].label}
        </Chip>
        {waitLeft > 0 && (
          <span
            className="text-warning flex shrink-0 items-center gap-1 text-xs tabular-nums"
            title="Waiting out the hunt's backoff">
            <HourglassIcon className="size-3" aria-hidden="true" />
            {countdown(waitLeft)}
          </span>
        )}
        {status === "queued" && retryAt !== null && waitLeft <= 0 && (
          <span className="text-success shrink-0 text-xs font-medium">Ready</span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted min-w-0 flex-1 truncate text-xs">
          {puzzleName && (
            <>
              <Link
                to="/$workspaceSlug/puzzles/$puzzleId"
                params={{workspaceSlug, puzzleId: guess.puzzleId}}
                className="text-foreground hover:underline">
                {puzzleName}
              </Link>
              {" · "}
            </>
          )}
          {guess.createdByName} · {timeAgo(guess.createdAt, now)}
        </span>
        {status === "queued" && waitLeft <= 0 && (
          <Button
            size="sm"
            variant="secondary"
            onPress={() => set(guess, {status: "submitted", retryAt: null})}>
            <SendIcon />
            Mark submitted
          </Button>
        )}
        {status === "submitted" && (
          <Button size="sm" variant="secondary" onPress={() => markCorrect(guess)}>
            <CheckIcon />
            Mark correct
          </Button>
        )}
        <Dropdown>
          <Button size="sm" isIconOnly variant="ghost" aria-label={`More for ${guess.answer}`}>
            <EllipsisIcon />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              aria-label={`Update ${guess.answer}`}
              onAction={key => {
                const action = String(key);
                if (action === "correct") markCorrect(guess);
                else if (isStatus(action)) set(guess, {status: action, retryAt: null});
              }}>
              <Dropdown.Item id="submitted" textValue="Submitted">
                <Label>Submitted</Label>
              </Dropdown.Item>
              <Dropdown.Item id="correct" textValue="Correct">
                <Label>Correct</Label>
              </Dropdown.Item>
              <Dropdown.Item id="incorrect" textValue="Wrong">
                <Label>Wrong</Label>
              </Dropdown.Item>
              <Dropdown.Item id="partial" textValue="Keep going">
                <Label>Keep going (partial)</Label>
              </Dropdown.Item>
              <Separator />
              <Dropdown.SubmenuTrigger>
                <Dropdown.Item id="wait" textValue="Back off">
                  <Label>Back off…</Label>
                  <Dropdown.SubmenuIndicator />
                </Dropdown.Item>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label="Wait before resubmitting"
                    onAction={key =>
                      set(guess, {
                        status: "queued",
                        retryAt: Date.now() + Number(String(key).slice(5)) * 60_000,
                      })
                    }>
                    {WAITS.map(minutes => (
                      <Dropdown.Item
                        key={minutes}
                        id={`wait-${minutes}`}
                        textValue={`${minutes} minutes`}>
                        <Label>
                          {minutes === 60
                            ? "1 hour"
                            : `${minutes} minute${minutes === 1 ? "" : "s"}`}
                        </Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.SubmenuTrigger>
              <Dropdown.Item id="queued" textValue="Back to the queue">
                <Label>Back to the queue</Label>
              </Dropdown.Item>
              <Dropdown.Item id="withdrawn" textValue="Withdraw">
                <Label>Withdraw</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </li>
  );
}

/**
 * A puzzle's guesses: queue one (warned if it's been tried), and every guess so far with where it
 * stands, newest first.
 */
export function PuzzleGuesses({
  workspaceSlug,
  puzzleId,
}: {
  workspaceSlug: string;
  puzzleId: string;
}) {
  const workspace = useWorkspace();
  const guesses = workspace.guesses.filter(g => g.puzzleId === puzzleId);
  const now = useNow(guesses);
  const [answer, setAnswer] = useState("");
  // Collapsed while the puzzle has no guesses (it's rarely needed), open once it has some; and
  // whichever way you last toggled it, after that.
  const [opened, setOpened] = useState<boolean | null>(null);
  const isOpen = opened ?? guesses.length > 0;
  const waiting = guesses.filter(isPending).length;
  const {mutate: add, isPending: isAdding} = useMutation(orpc.guesses.add.mutationOptions());
  const typed = normalizeAnswer(answer);
  const tried = typed ? guesses.find(g => normalizeAnswer(g.answer) === typed) : undefined;
  const submit = () => {
    if (!answer.trim()) return;
    add(
      {workspaceSlug, puzzleId, answer},
      {onSuccess: () => setAnswer(""), onError: () => toast.error("Couldn't queue that guess.")}
    );
  };
  return (
    <section className="border-separator flex flex-col gap-1.5 border-t p-3" aria-label="Guesses">
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpened(!isOpen)}
          className="text-muted hover:text-foreground -my-1 flex w-full items-center gap-1 py-1 text-start text-xs font-medium">
          <ChevronRightIcon
            className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
            aria-hidden="true"
          />
          Guesses
          <span className="tabular-nums">({guesses.length})</span>
          {waiting > 0 && (
            <Chip size="sm" variant="soft" color="accent" className="ms-auto">
              {waiting} waiting
            </Chip>
          )}
        </button>
      </h3>
      {isOpen && (
        <>
          <form
            className="flex items-start gap-2"
            onSubmit={event => {
              event.preventDefault();
              submit();
            }}>
            <TextField
              aria-label="Queue a guess"
              value={answer}
              onChange={setAnswer}
              variant="secondary"
              className="min-w-0 flex-1">
              <Input
                placeholder="Queue a guess"
                className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
              />
            </TextField>
            <Button type="submit" variant="secondary" isDisabled={!answer.trim() || isAdding}>
              Queue
            </Button>
          </form>
          {tried && (
            <p className="text-warning flex items-center gap-1.5 text-xs">
              <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
              Already guessed: {STATUS[statusOf(tried)].label.toLowerCase()}
              {tried.status === "queued" || tried.status === "submitted"
                ? ""
                : ` (${tried.answer})`}
              .
            </p>
          )}
          {guesses.length > 0 && (
            <ul className="divide-separator flex flex-col divide-y">
              {guesses.map(guess => (
                <GuessRow key={guess.id} guess={guess} workspaceSlug={workspaceSlug} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The workspace's guess queue, in the header: every guess waiting to be called in (oldest first, so
 * none is forgotten) or waiting on the hunt's reply, for whoever is calling answers in. Shown only
 * while there's at least one.
 */
export function GuessQueueButton({workspaceSlug}: {workspaceSlug: string}) {
  const workspace = useWorkspace();
  const pending = workspace.guesses
    .filter(isPending)
    .toSorted((a, b) => (ms(a.createdAt) ?? 0) - (ms(b.createdAt) ?? 0));
  const now = useNow(pending);
  const names = new Map(workspace.rounds.flatMap(r => r.puzzles).map(p => [p.id, p.name]));
  const queued = pending.filter(g => g.status === "queued");
  const submitted = pending.filter(g => g.status === "submitted");
  // Only there while something is waiting: an empty queue needs no button in the header.
  if (pending.length === 0) return null;
  return (
    <Popover>
      <Badge.Anchor>
        <Button
          size="sm"
          isIconOnly
          variant="ghost"
          aria-label={pending.length > 0 ? `Guess queue (${pending.length})` : "Guess queue"}>
          <ListOrderedIcon />
        </Button>
        {queued.length > 0 && (
          <Badge color="accent" size="sm" placement="top-right">
            {queued.length}
          </Badge>
        )}
      </Badge.Anchor>
      <Popover.Content placement="bottom end" className="w-[min(26rem,calc(100vw-2rem))]">
        <Popover.Dialog aria-label="Guess queue" className="flex max-h-[70vh] flex-col gap-3 p-3">
          <div>
            <h2 className="text-sm font-semibold">Guess queue</h2>
            <p className="text-muted text-xs">
              Answers to call in, oldest first. Queue one from a puzzle&apos;s page.
            </p>
            <HelpLink slug="guides/guess-queue">How the guess queue works</HelpLink>
          </div>
          {pending.length === 0 ? (
            <p className="text-muted py-4 text-center text-sm">Nothing waiting. Go guess!</p>
          ) : (
            <div className="flex min-h-0 flex-col gap-3 overflow-auto">
              {[
                ["To call in", queued],
                ["Waiting on the hunt", submitted],
              ].map(
                ([title, list]) =>
                  typeof title === "string" &&
                  Array.isArray(list) &&
                  list.length > 0 && (
                    <section key={title}>
                      <h3 className="text-muted text-[11px] font-semibold tracking-wide uppercase">
                        {title}
                      </h3>
                      <ul className="divide-separator flex flex-col divide-y">
                        {list.map(guess => (
                          <GuessRow
                            key={guess.id}
                            guess={guess}
                            workspaceSlug={workspaceSlug}
                            now={now}
                            puzzleName={names.get(guess.puzzleId) ?? "A deleted puzzle"}
                          />
                        ))}
                      </ul>
                    </section>
                  )
              )}
            </div>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
