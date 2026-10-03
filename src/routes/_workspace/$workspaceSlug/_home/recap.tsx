import {Avatar, Button, Card, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute} from "@tanstack/react-router";
import {DownloadIcon} from "lucide-react";
import {useRef} from "react";
import {toast} from "sonner";

import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
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

/** The recap's numbers and awards, in the viewer's time zone. */
function computeRecap(recap: Recap, solvedNow: Set<string>, metaIds: Set<string>) {
  const users = new Map(recap.users.map(user => [user.id, user]));
  const created = new Map<string, number>();
  // The latest solve of each puzzle that's still solved: who gets credit, and when.
  const solves = new Map<string, Recap["events"][number]>();
  const answers = new Map<string, number>();
  const added = new Map<string, number>();
  for (const event of recap.events) {
    if (event.type === "create" && event.puzzleId) {
      if (!created.has(event.puzzleId)) created.set(event.puzzleId, event.at);
      bump(added, event.userId);
    } else if (event.type === "updateAnswer") {
      bump(answers, event.userId);
    } else if (event.type === "updateStatus" && event.puzzleId && isSolve(event.field)) {
      solves.set(event.puzzleId, event);
    }
  }
  const finalSolves = [...solves.values()].filter(s => s.puzzleId && solvedNow.has(s.puzzleId));

  const perUser = new Map<string, number>();
  const night = new Map<string, number>();
  const early = new Map<string, number>();
  const backsolves = new Map<string, number>();
  const metas = new Map<string, number>();
  const byHour = new Map<number, number>();
  let fastest: {ms: number; event: Recap["events"][number]} | undefined;
  let slowest: {ms: number; event: Recap["events"][number]} | undefined;
  for (const solve of finalSolves) {
    bump(perUser, solve.userId);
    const hour = new Date(solve.at).getHours();
    if (hour < 6) bump(night, solve.userId);
    else if (hour < 10) bump(early, solve.userId);
    if (solve.field === "backsolved") bump(backsolves, solve.userId);
    if (solve.puzzleId && metaIds.has(solve.puzzleId)) bump(metas, solve.userId);
    const bucket = Math.floor(solve.at / HOUR);
    byHour.set(bucket, (byHour.get(bucket) ?? 0) + 1);
    const start = solve.puzzleId ? created.get(solve.puzzleId) : undefined;
    if (start !== undefined) {
      const ms = solve.at - start;
      if (ms > 0 && (!fastest || ms < fastest.ms)) fastest = {ms, event: solve};
      if (!slowest || ms > slowest.ms) slowest = {ms, event: solve};
    }
  }

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
  add("🏆", "MVP", leader(perUser), n => `${n} ${n === 1 ? "solve" : "solves"}`);
  add("👑", "Meta Maestro", leader(metas), n => `${n} ${n === 1 ? "meta" : "metas"} solved`);
  add("🦉", "Night Owl", leader(night), n => `${n} solves between midnight and 6am`);
  add("🌅", "Early Bird", leader(early), n => `${n} solves before 10am`);
  add(
    "🔙",
    "Backsolve Bandit",
    leader(backsolves),
    n => `${n} ${n === 1 ? "backsolve" : "backsolves"}`
  );
  const fastUser = fastest && users.get(fastest.event.userId);
  if (fastest && fastUser) {
    awards.push({
      emoji: "⚡",
      title: "Speedrunner",
      user: fastUser,
      stat: `${fastest.event.puzzleName} in ${formatSpan(fastest.ms)}`,
    });
  }
  const slowUser = slowest && users.get(slowest.event.userId);
  if (slowest && slowUser && slowest !== fastest) {
    awards.push({
      emoji: "🧗",
      title: "The Grind",
      user: slowUser,
      stat: `cracked ${slowest.event.puzzleName} after ${formatSpan(slowest.ms)}`,
    });
  }
  add("✍️", "Answer Machine", leader(answers), n => `${n} answers entered`);
  add("📚", "Librarian", leader(added), n => `${n} puzzles added`);

  const firstAt = recap.events[0]?.at;
  const lastSolveAt = finalSolves.reduce((max, s) => Math.max(max, s.at), 0);
  const busiest = [...byHour].toSorted((a, b) => b[1] - a[1])[0];
  return {
    awards,
    solves: finalSolves.length,
    metas: finalSolves.filter(s => s.puzzleId && metaIds.has(s.puzzleId)).length,
    solvers: perUser.size,
    span: firstAt !== undefined && lastSolveAt > firstAt ? lastSolveAt - firstAt : 0,
    busiest: busiest && {at: busiest[0] * HOUR, count: busiest[1]},
    you: (id: string | undefined) =>
      id
        ? {
            solves: perUser.get(id) ?? 0,
            answers: answers.get(id) ?? 0,
            added: added.get(id) ?? 0,
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

      {you && (you.solves > 0 || you.answers > 0 || you.added > 0) && (
        <Card>
          <Card.Header>
            <Card.Title>Your hunt</Card.Title>
            <Card.Description>
              {you.solves} {you.solves === 1 ? "solve" : "solves"} · {you.answers} answers entered ·{" "}
              {you.added} puzzles added
              {you.awards.length > 0 &&
                ` · ${you.awards.map(a => `${a.emoji} ${a.title}`).join(", ")}`}
            </Card.Description>
          </Card.Header>
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
