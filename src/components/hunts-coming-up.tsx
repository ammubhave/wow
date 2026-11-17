import {buttonVariants} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  GlobeIcon,
  MapPinIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import {useEffect, useState} from "react";

import {Grainient} from "@/components/grainient";
import {ShinyText, SpotlightCard} from "@/components/spotlight-card";
import {when, where} from "@/hooks/use-hunt-suggestions";
import {track} from "@/lib/analytics";
import {monthColors} from "@/lib/month-colors";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

type Hunt = RouterOutputs["huntListings"]["forYou"][number];

const SECOND_MS = 1000;
const HOUR_MS = 60 * 60 * SECOND_MS;
const DAY_MS = 24 * HOUR_MS;
/** Closer than this, a timed hunt counts down to the second. */
const COUNTDOWN_MS = 2 * DAY_MS;

const pad = (n: number) => String(n).padStart(2, "0");

/** "Starts in 1d 04:13:22" close up, else "Starts tomorrow" or "Starts in 12 days". */
function startsIn(hunt: Hunt, now: number) {
  if (!hunt.allDay) {
    const left = hunt.startsAt.getTime() - now;
    if (left < COUNTDOWN_MS) {
      const days = Math.floor(left / DAY_MS);
      const time = `${pad(Math.floor((left % DAY_MS) / HOUR_MS))}:${pad(Math.floor((left % HOUR_MS) / 60_000))}:${pad(Math.floor((left % 60_000) / SECOND_MS))}`;
      return `Starts in ${days > 0 ? `${days}d ` : ""}${time}`;
    }
  }
  // All-day dates are UTC midnights: count whole days.
  const today = new Date(now);
  const midnight = hunt.allDay
    ? Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    : now;
  const days = Math.round((hunt.startsAt.getTime() - midnight) / DAY_MS);
  if (days <= 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  return `Starts in ${days} days`;
}

/** The current time, ticking every second while a countdown shows (else every minute). */
function useNow(hunts: Hunt[] | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const counting = (hunts ?? []).some(hunt => {
    const left = hunt.startsAt.getTime() - now;
    return !hunt.allDay && left > 0 && left < COUNTDOWN_MS;
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), counting ? SECOND_MS : 60 * SECOND_MS);
    return () => clearInterval(timer);
  }, [counting]);
  return now;
}

/** A pin for a place you go to, a globe for online (including "…and online"). */
function PlaceIcon({hunt, className}: {hunt: Hunt; className?: string}) {
  return hunt.location && !/\bonline\b/i.test(hunt.location) ? (
    <MapPinIcon className={className} aria-hidden="true" />
  ) : (
    <GlobeIcon className={className} aria-hidden="true" />
  );
}

function LiveNow({color}: {color?: string}) {
  return (
    <span className="flex items-center gap-1.5 font-semibold">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="bg-success absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" />
        <span className="bg-success relative inline-flex size-2 rounded-full" />
      </span>
      <ShinyText color={color}>Live now</ShinyText>
    </span>
  );
}

function HuntCard({hunt, now}: {hunt: Hunt; now: number}) {
  const isLive = hunt.startsAt.getTime() <= now;
  const place = where(hunt);
  return (
    <SpotlightCard
      className="flex flex-col gap-3 p-4"
      color={
        isLive
          ? "color-mix(in oklab, var(--success) 20%, transparent)"
          : "color-mix(in oklab, var(--accent) 22%, transparent)"
      }>
      <div className="flex min-h-5 items-center justify-between gap-2 text-xs">
        {isLive ? (
          <LiveNow />
        ) : (
          <span className="text-accent font-semibold tabular-nums">{startsIn(hunt, now)}</span>
        )}
        {hunt.teams > 0 && (
          <span
            className="text-muted flex shrink-0 items-center gap-1"
            title={`${hunt.teams} ${hunt.teams === 1 ? "team has" : "teams have"} a workspace for it`}>
            <UsersIcon className="size-3.5" aria-hidden="true" />
            {hunt.teams} on WOW
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="line-clamp-2 leading-snug font-semibold">{hunt.name}</h3>
        <p className="text-muted flex min-w-0 items-center gap-1.5 text-xs">
          <PlaceIcon hunt={hunt} className="size-3.5 shrink-0" />
          <span className="truncate">{[when(hunt), place].filter(Boolean).join(" · ")}</span>
        </p>
      </div>
      <div className="mt-auto flex items-center gap-1.5">
        <Link
          to="/workspaces/create"
          search={{hunt: hunt.id, event: hunt.name}}
          onClick={() => track("hunt_shortcut_clicked", {hunt: hunt.name, live: isLive})}
          className={buttonVariants({size: "sm", variant: isLive ? "primary" : "secondary"})}>
          <SparklesIcon />
          Set up workspace
        </Link>
        {hunt.url && (
          <a
            href={hunt.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${hunt.name} website`}
            title="Hunt website"
            className={buttonVariants({size: "sm", variant: "ghost", isIconOnly: true})}>
            <ArrowUpRightIcon />
          </a>
        )}
      </div>
    </SpotlightCard>
  );
}

/**
 * The likeliest hunt, big: its name over a slowly moving gradient in its month's colours (as the
 * Puzzle Exchange covers are), with the countdown up top.
 */
function FeaturedHuntCard({hunt, now}: {hunt: Hunt; now: number}) {
  const isLive = hunt.startsAt.getTime() <= now;
  const place = where(hunt);
  return (
    <div className="relative isolate overflow-hidden rounded-2xl text-white sm:col-span-2">
      <Grainient colors={monthColors(hunt.startsAt)} className="absolute inset-0 -z-10" />
      {/* Keeps the text readable over the gradient's lighter patches. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-r from-black/75 via-black/45 to-black/5"
      />
      <div className="flex min-h-44 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2 text-xs">
          {isLive ? (
            <LiveNow color="#86efac" />
          ) : (
            <span className="rounded-full bg-black/35 px-2.5 py-1 font-semibold tabular-nums backdrop-blur">
              {startsIn(hunt, now)}
            </span>
          )}
          {hunt.teams > 0 && (
            <span className="flex shrink-0 items-center gap-1 text-white/80">
              <UsersIcon className="size-3.5" aria-hidden="true" />
              {hunt.teams} {hunt.teams === 1 ? "team" : "teams"} on WOW
            </span>
          )}
        </div>
        <div className="mt-auto flex flex-col gap-1">
          <h3 className="text-2xl leading-tight font-bold tracking-tight text-balance">
            {hunt.name}
          </h3>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-white/80">
            <PlaceIcon hunt={hunt} className="size-4 shrink-0" />
            <span className="truncate">{[when(hunt), place].filter(Boolean).join(" · ")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/workspaces/create"
            search={{hunt: hunt.id, event: hunt.name}}
            onClick={() =>
              track("hunt_shortcut_clicked", {hunt: hunt.name, live: isLive, featured: true})
            }
            className={buttonVariants({
              size: "sm",
              className: "bg-white text-black hover:bg-white/90",
            })}>
            <SparklesIcon />
            Set up workspace
          </Link>
          {hunt.url && (
            <a
              href={hunt.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-sm text-white/80 hover:text-white">
              Hunt website
              <ArrowUpRightIcon className="size-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shortcuts to set up a workspace for the hunts you're most likely to play next (ongoing or
 * coming up soon, that you don't have a workspace for yet). Nothing when there are none.
 */
export function HuntsComingUp() {
  const {data: hunts} = useQuery({
    ...orpc.huntListings.forYou.queryOptions(),
    staleTime: 10 * 60 * SECOND_MS,
  });
  const now = useNow(hunts);
  if (!hunts || hunts.length === 0) return null;
  return (
    <section aria-labelledby="hunts-coming-up" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="hunts-coming-up" className="font-semibold tracking-tight">
            Hunts coming up
          </h2>
          <p className="text-muted text-xs">Set one up for your team in a click.</p>
        </div>
        <Link
          to="/hunts"
          className="text-muted hover:text-foreground flex shrink-0 items-center gap-0.5 text-xs">
          All hunts
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hunts.map((hunt, i) =>
          i === 0 ? (
            <FeaturedHuntCard key={hunt.id} hunt={hunt} now={now} />
          ) : (
            <HuntCard key={hunt.id} hunt={hunt} now={now} />
          )
        )}
      </div>
    </section>
  );
}
