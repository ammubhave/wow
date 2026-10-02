import {Avatar, AvatarGroup, Chip, ProgressBar} from "@heroui/react";
import {CheckIcon, StarIcon} from "lucide-react";
import {useEffect, useState} from "react";
import {cn} from "tailwind-variants";

import {DecryptedText} from "../decrypted-text";
import {SolveSpark} from "../solve-spark";

type Status = "solved" | "in-progress" | "needs-eyes" | "stuck";

const STATUS: Record<Status, {label: string; color: "success" | "accent" | "warning" | "danger"}> =
  {
    solved: {label: "Solved", color: "success"},
    "in-progress": {label: "In progress", color: "accent"},
    "needs-eyes": {label: "Needs eyes", color: "warning"},
    stuck: {label: "Stuck", color: "danger"},
  };

// A pretend round. The demo solves the unsolved ones top to bottom, one per tick.
const PUZZLES = [
  // solveOrder: the tick it gets solved on (0 = already solved).
  {name: "Crown Jewels", answer: "TIARA", status: "solved", people: [], solveOrder: 0},
  {
    name: "Cracking the Safe",
    answer: "TUMBLER",
    status: "in-progress",
    people: ["AB", "KM"],
    solveOrder: 1,
  },
  {name: "Getaway Car", answer: "CHAUFFEUR", status: "needs-eyes", people: ["JL"], solveOrder: 2},
  {name: "Inside Job", answer: "MOLE", status: "stuck", people: ["RS", "TV", "PQ"], solveOrder: 3},
  {
    name: "The Heist",
    answer: "VAULTED",
    status: "in-progress",
    people: ["AB"],
    solveOrder: 4,
    isMeta: true,
  },
] as const;

const TICK_MS = 2600;

/** The landing page's living blackboard: puzzles get solved one by one, then it starts over. */
export function BoardDemo() {
  const [reduceMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  // How many of the unsolved puzzles have been solved so far in this loop.
  const [{tick, loop}, setClock] = useState({tick: 0, loop: 0});
  const unsolvedCount = PUZZLES.filter(p => p.status !== "solved").length;

  useEffect(() => {
    if (reduceMotion) return undefined;
    // One extra tick holds the finished board before it starts over.
    const id = setInterval(
      () =>
        setClock(clock =>
          clock.tick >= unsolvedCount + 1
            ? {tick: 0, loop: clock.loop + 1}
            : {tick: clock.tick + 1, loop: clock.loop}
        ),
      TICK_MS
    );
    return () => clearInterval(id);
  }, [reduceMotion, unsolvedCount]);

  const isSolved = (puzzle: (typeof PUZZLES)[number]) => puzzle.solveOrder <= tick;
  const rows = PUZZLES;
  const solved = rows.filter(isSolved).length;

  return (
    <DemoFrame address="wafflehaus.io/your-team">
      <div className="flex flex-col p-3 text-sm">
        <div className="bg-surface-secondary flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="font-semibold">Act I · The Heist</span>
          <ProgressBar
            aria-label="Round progress"
            value={(solved / rows.length) * 100}
            size="sm"
            color={solved === rows.length ? "success" : "accent"}
            className="w-20 gap-0">
            <ProgressBar.Track className="w-full">
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          <span className="text-muted text-xs tabular-nums">
            {solved}/{rows.length}
          </span>
        </div>
        {rows.map(row => {
          const rowSolved = isSolved(row);
          const status = rowSolved ? STATUS.solved : STATUS[row.status];
          return (
            <div
              key={row.name}
              className={cn(
                // Fixed height: avatars (unsolved only) are taller than text, so rows would shrink as they
                // get solved and shift the page.
                "border-separator grid h-12 grid-cols-[1fr_auto] items-center gap-3 border-b px-3 last:border-b-0 sm:grid-cols-[1.4fr_1fr_auto_auto]",
                rowSolved && "text-muted"
              )}>
              <span className="flex min-w-0 items-center gap-2">
                {rowSolved ? (
                  <CheckIcon className="text-success size-4 shrink-0" />
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <span className={cn("truncate", !rowSolved && "text-foreground")}>{row.name}</span>
                {"isMeta" in row && (
                  <StarIcon className="text-warning size-3.5 shrink-0 fill-current" />
                )}
              </span>
              <span className="hidden font-mono text-xs tracking-wide sm:block">
                {rowSolved ? (
                  reduceMotion || row.status === "solved" ? (
                    row.answer
                  ) : (
                    <DecryptedText
                      key={`${row.name}-${loop}`}
                      text={row.answer}
                      speed={70}
                      encryptedClassName="text-accent"
                    />
                  )
                ) : null}
              </span>
              <SolveSpark isSolved={rowSolved}>
                <Chip size="sm" variant="soft" color={status.color} className="w-24 justify-center">
                  {status.label}
                </Chip>
              </SolveSpark>
              <span className="hidden w-20 justify-end sm:flex">
                {!rowSolved && row.people.length > 0 && (
                  <AvatarGroup size="sm">
                    {row.people.map(initials => (
                      <Avatar key={initials} size="sm">
                        <Avatar.Fallback>{initials}</Avatar.Fallback>
                      </Avatar>
                    ))}
                  </AvatarGroup>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </DemoFrame>
  );
}

/** A browser-window frame for the landing page's pretend product shots (decorative). */
export function DemoFrame({
  address,
  className,
  children,
}: {
  address: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-surface border-separator shadow-overlay w-full overflow-hidden rounded-2xl border select-none",
        className
      )}>
      <div className="border-separator flex items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-danger/70 size-2.5 rounded-full" />
        <span className="bg-warning/70 size-2.5 rounded-full" />
        <span className="bg-success/70 size-2.5 rounded-full" />
        <span className="text-muted ms-3 font-mono text-xs">{address}</span>
      </div>
      {children}
    </div>
  );
}
