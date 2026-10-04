import {Avatar, Button, Card, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {DownloadIcon} from "lucide-react";
import {useRef} from "react";
import {toast} from "sonner";

import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {formatPuzzleTime, useMyPuzzleTimes} from "@/hooks/use-puzzle-time";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/recap")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Hunt Recap | WOW"}]}),
});

type Recap = RouterOutputs["workspaces"]["recap"];
type User = Recap["users"][number];
type Award = {emoji: string; title: string; user: User; stat: string};

const isSolve = (field: string | null) => field === "solved" || field === "backsolved";
const HOUR = 3_600_000;

function formatSpan(ms: number) {
  const hours = Math.round(ms / HOUR);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} minutes`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/** Who has the most of something (ties: whoever got there first). */
function leader(counts: Map<string, number>) {
  let best: [string, number] | undefined;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  return best && best[1] > 0 ? best : undefined;
}

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

/** Time awards need at least this much (seconds), so a few stray minutes don't win one. */
const MIN_AWARD_SECONDS = 10 * 60;

const sumBy = (map: Map<string, number>, key: string, amount: number) =>
  map.set(key, (map.get(key) ?? 0) + amount);

/**
 * The recap's numbers and awards. Solving is a team effort, so nothing here credits whoever marked
 * a puzzle solved: people are credited for what they say they helped solve (the honor code), for
 * their active time (in their own time zone), and for keeping the board up to date.
 */
function computeRecap(recap: Recap, solvedNow: Set<string>, metaIds: Set<string>) {
  const users = new Map(recap.users.map(user => [user.id, user]));

  // The team's numbers: the latest solve of each puzzle that's still solved.
  const solves = new Map<string, Recap["events"][number]>();
  // Keeping the board up to date: adding puzzles and rounds, statuses, answers, importance.
  const boardUpdates = new Map<string, number>();
  for (const event of recap.events) {
    bump(boardUpdates, event.userId);
    if (event.type === "updateStatus" && event.puzzleId && isSolve(event.field)) {
      solves.set(event.puzzleId, event);
    }
  }
  for (const {userId, count} of recap.roundsCreated) sumBy(boardUpdates, userId, count);
  const finalSolves = [...solves.values()].filter(s => s.puzzleId && solvedNow.has(s.puzzleId));
  const byHour = new Map<number, number>();
  for (const solve of finalSolves) {
    const hour = Math.floor(solve.at / HOUR);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }

  // Who helped solve what (self-reported), counting puzzles that are solved.
  const helped = new Map<string, number>();
  const metasHelped = new Map<string, number>();
  for (const {puzzleId, userId} of recap.contributions) {
    if (!solvedNow.has(puzzleId)) continue;
    bump(helped, userId);
    if (metaIds.has(puzzleId)) bump(metasHelped, userId);
  }

  // Active time on puzzles, by the hour of day where each person was.
  const activeTotal = new Map<string, number>();
  const night = new Map<string, number>();
  const early = new Map<string, number>();
  for (const {userId, localHour, seconds} of recap.activeTime) {
    sumBy(activeTotal, userId, seconds);
    if (localHour < 6) sumBy(night, userId, seconds);
    else if (localHour < 10) sumBy(early, userId, seconds);
  }
  const timeLeader = (map: Map<string, number>) => {
    const best = leader(map);
    return best && best[1] >= MIN_AWARD_SECONDS ? best : undefined;
  };

  const awards: Award[] = [];
  const add = (
    emoji: string,
    title: string,
    entry: [string, number] | undefined,
    stat: (n: number) => string
  ) => {
    const user = entry && users.get(entry[0]);
    if (user && entry) awards.push({emoji, title, user, stat: stat(entry[1])});
  };
  add("🏆", "MVP", leader(helped), n => `helped solve ${n} ${n === 1 ? "puzzle" : "puzzles"}`);
  add(
    "👑",
    "Meta Maestro",
    leader(metasHelped),
    n => `helped solve ${n} ${n === 1 ? "meta" : "metas"}`
  );
  add(
    "🦉",
    "Night Owl",
    timeLeader(night),
    n => `${formatPuzzleTime(n)} puzzling between midnight and 6am`
  );
  add(
    "🌅",
    "Early Bird",
    timeLeader(early),
    n => `${formatPuzzleTime(n)} puzzling between 6 and 10am`
  );
  add("🏃", "Marathoner", timeLeader(activeTotal), n => `${formatPuzzleTime(n)} actively puzzling`);
  add("📋", "Board Keeper", leader(boardUpdates), n => `kept the board current: ${n} updates`);

  const firstAt = recap.events[0]?.at;
  const lastSolveAt = finalSolves.reduce((max, s) => Math.max(max, s.at), 0);
  const busiest = [...byHour].toSorted((a, b) => b[1] - a[1])[0];
  return {
    awards,
    solves: finalSolves.length,
    metas: finalSolves.filter(s => s.puzzleId && metaIds.has(s.puzzleId)).length,
    // Everyone who helped solve something (or, without any marks yet, who was active).
    solvers: (helped.size > 0 ? helped : activeTotal).size,
    span: firstAt !== undefined && lastSolveAt > firstAt ? lastSolveAt - firstAt : 0,
    busiest: busiest && {at: busiest[0] * HOUR, count: busiest[1]},
    you: (id: string | undefined) =>
      id
        ? {
            helped: helped.get(id) ?? 0,
            activeSeconds: activeTotal.get(id) ?? 0,
            boardUpdates: boardUpdates.get(id) ?? 0,
            awards: awards.filter(a => a.user.id === id),
          }
        : undefined,
  };
}

const busiestFormat = new Intl.DateTimeFormat(undefined, {weekday: "long", hour: "numeric"});

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const me = authClient.useSession().data?.user.id;
  const cardRef = useRef<HTMLDivElement>(null);
  const {data} = useQuery(orpc.workspaces.recap.queryOptions({input: {workspaceSlug}}));
  const myTimes = useMyPuzzleTimes(workspaceSlug);
  const puzzles = workspace.rounds.flatMap(round => round.puzzles);
  const solvedNow = new Set(puzzles.filter(p => isSolve(p.status)).map(p => p.id));
  const metaIds = new Set(puzzles.filter(p => p.isMetaPuzzle).map(p => p.id));

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-8">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  const recap = computeRecap(data, solvedNow, metaIds);
  const you = recap.you(me);
  const puzzleNames = new Map(puzzles.map(p => [p.id, p.name]));
  // Most time first (as the server sorts them), skipping deleted puzzles.
  const myTopPuzzles = (myTimes ?? []).filter(t => puzzleNames.has(t.puzzleId)).slice(0, 5);
  const teamName = workspace.teamName || workspace.name;

  const download = async () => {
    if (!cardRef.current) return;
    try {
      const {toPng} = await import("html-to-image");
      const url = await toPng(cardRef.current, {pixelRatio: 2, cacheBust: true});
      const link = document.createElement("a");
      link.download = `${teamName} hunt recap.png`;
      link.href = url;
      link.click();
      track("recap_image_saved");
    } catch {
      toast.error("Couldn't make the image. Try a screenshot instead!");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Hunt recap</h1>
        <Button variant="outline" onPress={() => void download()}>
          <DownloadIcon />
          Save as image
        </Button>
      </div>

      {/* The shareable card. */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl p-6 text-white md:p-8"
        style={{
          background:
            "radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var(--accent) 85%, white 15%) 0%, var(--accent) 35%, color-mix(in oklab, var(--accent) 45%, black 55%) 100%)",
        }}>
        <p className="text-sm font-medium tracking-wide text-white/75">{workspace.eventName}</p>
        <h2 className="mt-1 text-3xl font-bold md:text-4xl">
          {workspace.theme.emoji && <span className="me-2">{workspace.theme.emoji}</span>}
          {teamName}
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            [String(recap.solves), recap.solves === 1 ? "puzzle solved" : "puzzles solved"],
            [String(recap.metas), recap.metas === 1 ? "meta" : "metas"],
            [String(recap.solvers), recap.solvers === 1 ? "solver" : "solvers"],
            [recap.span ? formatSpan(recap.span).split(" ")[0]! : "—", "hours of hunting"],
          ].map(([value, label]) => (
            <div key={label} className="flex flex-col">
              <dt className="order-2 text-xs text-white/75">{label}</dt>
              <dd className="order-1 text-3xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {recap.awards.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {recap.awards.slice(0, 3).map(award => (
              <li key={award.title} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{award.emoji}</span>
                <span className="font-semibold">{award.title}:</span>
                <span className="truncate text-white/85">{award.user.name}</span>
              </li>
            ))}
          </ul>
        )}
        {recap.busiest && (
          <p className="mt-4 text-xs text-white/70">
            Busiest hour: {busiestFormat.format(recap.busiest.at)} ({recap.busiest.count} solves)
          </p>
        )}
        <p className="absolute right-6 bottom-4 text-xs font-semibold text-white/60">
          wafflehaus.io
        </p>
      </div>

      {you && (you.helped > 0 || you.boardUpdates > 0 || you.activeSeconds > 0) && (
        <Card>
          <Card.Header>
            <Card.Title>Your hunt</Card.Title>
            <Card.Description>
              {[
                `helped solve ${you.helped} ${you.helped === 1 ? "puzzle" : "puzzles"}`,
                you.activeSeconds > 0 && `${formatPuzzleTime(you.activeSeconds)} active`,
                `${you.boardUpdates} board ${you.boardUpdates === 1 ? "update" : "updates"}`,
                ...you.awards.map(a => `${a.emoji} ${a.title}`),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Card.Description>
          </Card.Header>
          {myTopPuzzles.length > 0 && (
            <Card.Content>
              <p className="text-muted mb-2 text-xs">Where your time went</p>
              <ol className="flex flex-col gap-1.5 text-sm">
                {myTopPuzzles.map(t => (
                  <li key={t.puzzleId} className="flex items-center gap-3">
                    <Link
                      to="/$workspaceSlug/puzzles/$puzzleId"
                      params={{workspaceSlug, puzzleId: t.puzzleId}}
                      className="min-w-0 flex-1 truncate hover:underline">
                      {puzzleNames.get(t.puzzleId)}
                    </Link>
                    <span className="text-muted tabular-nums">{formatPuzzleTime(t.seconds)}</span>
                  </li>
                ))}
              </ol>
            </Card.Content>
          )}
        </Card>
      )}

      {recap.awards.length > 0 ? (
        <section aria-label="Awards" className="grid gap-3 sm:grid-cols-2">
          {recap.awards.map(award => (
            <Card key={award.title}>
              <Card.Content className="flex items-start gap-3">
                <span className="text-3xl leading-none">{award.emoji}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-semibold">{award.title}</span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <Avatar size="sm" className="size-5">
                      <Avatar.Image src={userAvatarSrc(award.user)} alt="" />
                      <Avatar.Fallback>{userInitials(award.user.name)}</Avatar.Fallback>
                    </Avatar>
                    {award.user.name}
                  </span>
                  <span className="text-muted text-xs">{award.stat}</span>
                </div>
              </Card.Content>
            </Card>
          ))}
        </section>
      ) : (
        <p className="text-muted text-center text-sm">
          No awards yet. Go solve something, the trophies are waiting.
        </p>
      )}
    </div>
  );
}
