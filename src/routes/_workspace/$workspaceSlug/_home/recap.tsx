import {KPIGroup} from "@heroui-pro/react";
import {KPI} from "@heroui-pro/react/kpi";
import {Avatar, Button, buttonVariants, Card, Chip, Skeleton} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link} from "@tanstack/react-router";
import {DownloadIcon, HeartIcon, XIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {toast} from "sonner";
import {cn} from "tailwind-variants";

import {Page, READING_WIDTH} from "@/components/page";
import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {HelpLink} from "@/docs/components/help-link";
import {computeRecap, HOUR, isSolve, type Standing, type User} from "@/features/awards/compute";
import {formatPuzzleTime, useMyPuzzleTimes} from "@/hooks/use-puzzle-time";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import {SUPPORT_URL, trackSupportClick} from "@/lib/support";

export const Route = createFileRoute("/_workspace/$workspaceSlug/_home/recap")({
  component: RouteComponent,
  head: () => ({meta: [{title: "Leaderboard | WOW"}]}),
});

function formatSpan(ms: number) {
  const hours = Math.round(ms / HOUR);
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(ms / 60_000));
    return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

/**
 * "Chip in for WOW" after the hunt (any amount, no suggestion). Dismissable (remembered in this
 * browser, per workspace).
 */
function SupportCard({
  workspaceSlug,
  teamName,
  solves,
  solvers,
  onShare,
}: {
  workspaceSlug: string;
  teamName: string;
  solves: number;
  solvers: number;
  onShare: () => void;
}) {
  const key = `wow:support-dismissed:${workspaceSlug}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (!dismissed) track("support_prompt_shown", {place: "recap", solves, solvers});
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per visit, not on every update.
  }, [dismissed]);
  if (dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    track("support_prompt_dismissed", {place: "recap"});
    try {
      localStorage.setItem(key, "1");
    } catch {
      // Not remembered (private window): it comes back next visit, which is fine.
    }
  };
  return (
    <Card className="border-accent/30 bg-accent/5 border">
      <Card.Header className="flex-row items-start gap-3">
        <HeartIcon className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Card.Title>Glad you hunted with WOW?</Card.Title>
          <Card.Description>
            {teamName} solved {solves} {solves === 1 ? "puzzle" : "puzzles"} here. WOW is free and
            made by Team Wafflehaüs. If you'd like to chip in, any amount helps keep it that way.
          </Card.Description>
        </div>
        <Button size="sm" variant="ghost" isIconOnly aria-label="Not now" onPress={dismiss}>
          <XIcon />
        </Button>
      </Card.Header>
      <Card.Footer className="flex-wrap gap-2 ps-8">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({size: "sm"})}
          onClick={() => trackSupportClick("recap", {solves, solvers})}>
          <HeartIcon />
          Chip in
        </a>
        <Button size="sm" variant="secondary" onPress={onShare}>
          <DownloadIcon />
          Save the recap to share
        </Button>
      </Card.Footer>
    </Card>
  );
}

/** The card's "how long" figure: the number big, its unit in the label ("3" "hours of hunting"). */
function spanStat(span: number | null | undefined): [string, string] {
  if (!span) return ["—", "hours of hunting"];
  const [value = "—", unit = "hours"] = formatSpan(span).split(" ");
  return [value, `${unit} of hunting`];
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
    <li className={cn("flex min-w-0 items-center gap-2 px-2 py-1 text-sm", isMe && "bg-accent/10")}>
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
  isOver,
}: {
  standings: Standing[];
  me: string | undefined;
  isLive: boolean;
  /** The hunt has ended (before it starts, the standings are only "so far"). */
  isOver: boolean;
}) {
  return (
    <section aria-label="Standings" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {isLive ? "The race so far" : isOver ? "Final standings" : "Standings so far"}
        </h2>
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
  const isOver = Boolean(workspace.huntEndsAt && now >= new Date(workspace.huntEndsAt).getTime());
  const isLive =
    !isOver && !(workspace.huntStartsAt && now < new Date(workspace.huntStartsAt).getTime());
  // Always "Leaderboard", like its tab (after the hunt it also has the recap card to share).
  const pageTitle = "Leaderboard";
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
      <Page title={pageTitle}>
        <div className={cn(READING_WIDTH, "flex flex-col gap-4")}>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-40 w-full" />
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
        className="relative overflow-hidden p-6 text-white md:p-8"
        style={{
          background:
            // Darkened from the accent, so the white text reads on light accents like Gold too.
            "radial-gradient(120% 120% at 0% 0%, color-mix(in oklab, var(--accent) 80%, black 20%) 0%, color-mix(in oklab, var(--accent) 65%, black 35%) 40%, color-mix(in oklab, var(--accent) 40%, black 60%) 100%)",
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
            spanStat(recap.span),
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
            Busiest hour: {busiestFormat.format(recap.busiest.at)} ({recap.busiest.count}{" "}
            {recap.busiest.count === 1 ? "solve" : "solves"})
          </p>
        )}
        <p className="absolute right-6 bottom-4 text-xs font-semibold text-white/60">
          www.wafflehaus.io
        </p>
      </div>
    </>
  );
  const yourHunt = (
    <>
      {you && (you.helped > 0 || you.boardUpdates > 0 || you.activeSeconds > 0) && (
        <Card>
          <Card.Header className="gap-3">
            <Card.Title>Your hunt</Card.Title>
            <KPIGroup>
              <KPI>
                <KPI.Header>
                  <KPI.Title>Helped solve</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={you.helped} />
                </KPI.Content>
              </KPI>
              <KPIGroup.Separator />
              <KPI>
                <KPI.Header>
                  <KPI.Title>Time on puzzles</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  {/* Minutes under an hour; hours (to a tenth) above. */}
                  {you.activeSeconds < 3600 ? (
                    <KPI.Value
                      value={Math.round(you.activeSeconds / 60)}
                      style="unit"
                      unit="minute"
                    />
                  ) : (
                    <KPI.Value
                      value={you.activeSeconds / 3600}
                      style="unit"
                      unit="hour"
                      maximumFractionDigits={1}
                    />
                  )}
                </KPI.Content>
              </KPI>
              <KPIGroup.Separator />
              <KPI>
                <KPI.Header>
                  <KPI.Title>Board updates</KPI.Title>
                </KPI.Header>
                <KPI.Content>
                  <KPI.Value value={you.boardUpdates} />
                </KPI.Content>
              </KPI>
            </KPIGroup>
            {you.awards.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {you.awards.map(award => (
                  <Chip key={award.title} size="sm" variant="soft" color="accent">
                    <span aria-hidden="true">{award.emoji}</span>
                    <Chip.Label>{award.title}</Chip.Label>
                  </Chip>
                ))}
              </div>
            )}
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
  const standings = (
    <Standings standings={recap.standings} me={me} isLive={isLive} isOver={isOver} />
  );
  // After the hunt (or, with no end date set, once the team has really used WOW), ask the team to
  // chip in: the moment they're most glad they had it.
  const askForSupport = isOver || (!workspace.huntEndsAt && recap.solves >= 10);
  const support = (
    <SupportCard
      workspaceSlug={workspaceSlug}
      teamName={teamName}
      solves={recap.solves}
      solvers={recap.solvers}
      onShare={() => void download()}
    />
  );

  return (
    <Page
      title={pageTitle}
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
            {askForSupport && support}
          </>
        ) : (
          <>
            {card}
            {askForSupport && support}
            {yourHunt}
            {standings}
          </>
        )}
      </div>
    </Page>
  );
}
