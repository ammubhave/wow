import {Avatar, Button, Card, Chip, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {DownloadIcon} from "lucide-react";
import {useRef, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {Page, READING_WIDTH} from "@/components/page";
import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {HelpLink} from "@/docs/components/help-link";
import {formatPuzzleTime, useMyPuzzleTimes} from "@/hooks/use-puzzle-time";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/recap")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Leaderboard | WOW"}]}),
});

type Recap = RouterOutputs["workspaces"]["recap"];
type User = Recap["users"][number];
type Award = {emoji: string; title: string; user: User; stat: string};
/** One award's race: everyone with any of it, most first. */
type Standing = {
  emoji: string;
  title: string;
  ranked: {user: User; value: number}[];
  stat: (n: number) => string;
  /** The number alone, for a standings row ("12 puzzles", "3h 20m"). */
  short: (n: number) => string;
};

const isSolve = (field: string | null) => field === "solved" || field === "backsolved";
const HOUR = 3_600_000;

function formatSpan(ms: number) {
  const hours = Math.round(ms / HOUR);
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} minutes`;
  return hours === 1 ? "1 hour" : `${hours} hours`;
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

  // The awards, each a race: the leader wins it (time ones need a real amount, so a few stray
  // minutes don't), and the standings show everyone's place, live during the hunt.
  const races: {
    emoji: string;
    title: string;
    counts: Map<string, number>;
    stat: (n: number) => string;
    short: (n: number) => string;
    min?: number;
  }[] = [
    {
      emoji: "🏆",
      title: "MVP",
      counts: helped,
      stat: n => `helped solve ${n} ${n === 1 ? "puzzle" : "puzzles"}`,
      short: n => `${n} ${n === 1 ? "puzzle" : "puzzles"}`,
    },
    {
      emoji: "👑",
      title: "Meta Maestro",
      counts: metasHelped,
      stat: n => `helped solve ${n} ${n === 1 ? "meta" : "metas"}`,
      short: n => `${n} ${n === 1 ? "meta" : "metas"}`,
    },
    {
      emoji: "🦉",
      title: "Night Owl",
      counts: night,
      stat: n => `${formatPuzzleTime(n)} puzzling between midnight and 6am`,
      short: formatPuzzleTime,
      min: MIN_AWARD_SECONDS,
    },
    {
      emoji: "🌅",
      title: "Early Bird",
      counts: early,
      stat: n => `${formatPuzzleTime(n)} puzzling between 6 and 10am`,
      short: formatPuzzleTime,
      min: MIN_AWARD_SECONDS,
    },
    {
      emoji: "🏃",
      title: "Marathoner",
      counts: activeTotal,
      stat: n => `${formatPuzzleTime(n)} actively puzzling`,
      short: formatPuzzleTime,
      min: MIN_AWARD_SECONDS,
    },
    {
      emoji: "📋",
      title: "Board Keeper",
      counts: boardUpdates,
      stat: n => `kept the board current: ${n} updates`,
      short: n => `${n} ${n === 1 ? "update" : "updates"}`,
    },
  ];
  const standings: Standing[] = races.map(race => ({
    emoji: race.emoji,
    title: race.title,
    stat: race.stat,
    short: race.short,
    // Most first; ties keep whoever got there first (the map's order).
    ranked: [...race.counts]
      .flatMap(([id, value]) => {
        const user = users.get(id);
        return user && value > 0 ? [{user, value}] : [];
      })
      .toSorted((x, y) => y.value - x.value),
  }));
  const awards: Award[] = standings.flatMap((standing, i) => {
    const top = standing.ranked[0];
    const min = races[i]?.min ?? 1;
    return top && top.value >= min
      ? [
          {
            emoji: standing.emoji,
            title: standing.title,
            user: top.user,
            stat: standing.stat(top.value),
          },
        ]
      : [];
  });

  const firstAt = recap.events[0]?.at;
  const lastSolveAt = finalSolves.reduce((max, s) => Math.max(max, s.at), 0);
  const busiest = [...byHour].toSorted((a, b) => b[1] - a[1])[0];
  return {
    awards,
    standings,
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

/** How often the live leaderboard refreshes. */
const LIVE_REFRESH_MS = 60_000;
const MEDALS = ["🥇", "🥈", "🥉"];
/** Places shown per award; you're shown too, wherever you are. */
const TOP = 3;

function StandingRow({
  place,
  user,
  stat,
  isMe,
}: {
  place: number;
  user: User;
  stat: string;
  isMe: boolean;
}) {
  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm",
        isMe && "bg-accent/10"
      )}>
      <span className="w-6 shrink-0 text-center tabular-nums">
        {MEDALS[place - 1] ?? <span className="text-muted text-xs">#{place}</span>}
      </span>
      <Avatar size="sm" className="size-5 shrink-0">
        <Avatar.Image src={userAvatarSrc(user)} alt="" />
        <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
      </Avatar>
      <span className={cn("min-w-0 truncate", isMe && "font-semibold")}>
        {isMe ? "You" : user.name}
      </span>
      <span className="text-muted ms-auto shrink-0 text-xs">{stat}</span>
    </li>
  );
}

/**
 * Every award as a race: the top three (and you, wherever you are). During the hunt it's the
 * live leaderboard; afterwards, the final standings behind each award.
 */
function Standings({
  standings,
  me,
  isLive,
}: {
  standings: Standing[];
  me: string | undefined;
  isLive: boolean;
}) {
  return (
    <section aria-label="Standings" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{isLive ? "The race so far" : "Final standings"}</h2>
        <span className="flex items-center gap-3">
          {isLive && <span className="text-muted text-xs">Updates every minute</span>}
          <HelpLink slug="guides/leaderboard">How awards work</HelpLink>
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {standings.map(standing => {
          const mine = standing.ranked.findIndex(entry => entry.user.id === me);
          return (
            <Card key={standing.title}>
              <Card.Header className="flex-row items-center gap-2">
                <span className="text-2xl leading-none" aria-hidden="true">
                  {standing.emoji}
                </span>
                <Card.Title>{standing.title}</Card.Title>
              </Card.Header>
              <Card.Content>
                {standing.ranked.length === 0 ? (
                  <p className="text-muted text-sm">Up for grabs.</p>
                ) : (
                  <ol className="flex flex-col gap-0.5">
                    {standing.ranked.slice(0, TOP).map((entry, i) => (
                      <StandingRow
                        key={entry.user.id}
                        place={i + 1}
                        user={entry.user}
                        stat={standing.short(entry.value)}
                        isMe={entry.user.id === me}
                      />
                    ))}
                    {mine >= TOP && (
                      <StandingRow
                        place={mine + 1}
                        user={standing.ranked[mine]!.user}
                        stat={standing.short(standing.ranked[mine]!.value)}
                        isMe
                      />
                    )}
                  </ol>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function RouteComponent() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const me = authClient.useSession().data?.user.id;
  const cardRef = useRef<HTMLDivElement>(null);
  // During the hunt (not before it starts, nor after it ends) this is a live leaderboard.
  const [now] = useState(() => Date.now());
  const isLive =
    !(workspace.huntEndsAt && now >= new Date(workspace.huntEndsAt).getTime()) &&
    !(workspace.huntStartsAt && now < new Date(workspace.huntStartsAt).getTime());
  const {data} = useQuery({
    ...orpc.workspaces.recap.queryOptions({input: {workspaceSlug}}),
    refetchInterval: isLive ? LIVE_REFRESH_MS : false,
  });
  const myTimes = useMyPuzzleTimes(workspaceSlug);
  const puzzles = workspace.rounds.flatMap(round => round.puzzles);
  const solvedNow = new Set(puzzles.filter(p => isSolve(p.status)).map(p => p.id));
  const metaIds = new Set(puzzles.filter(p => p.isMetaPuzzle).map(p => p.id));

  if (!data) {
    return (
      <Page title={isLive ? "Leaderboard" : "Hunt recap"}>
        <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </Page>
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

  const card = (
    <>
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
    </>
  );
  const yourHunt = (
    <>
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
    </>
  );
  const standings = <Standings standings={recap.standings} me={me} isLive={isLive} />;

  return (
    <Page
      title={isLive ? "Leaderboard" : "Hunt recap"}
      actions={
        <>
          {isLive && (
            <Chip color="success" variant="soft">
              <span className="bg-success size-1.5 animate-pulse rounded-full" aria-hidden="true" />
              <Chip.Label>Live</Chip.Label>
            </Chip>
          )}
          <Button variant="outline" onPress={() => void download()}>
            <DownloadIcon />
            Save as image
          </Button>
        </>
      }>
      <div className={cn(READING_WIDTH, "flex flex-col gap-6")}>
        {isLive ? (
          <>
            {standings}
            {yourHunt}
            {card}
          </>
        ) : (
          <>
            {card}
            {yourHunt}
            {standings}
          </>
        )}
      </div>
    </Page>
  );
}
