import {Tooltip} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {createContext, useContext, useMemo} from "react";
import {cn} from "tailwind-variants";

import {useWorkspace} from "@/hooks/use-workspace";
import {orpc} from "@/lib/orpc";

import {computeRecap, isSolve} from "./compute";

/**
 * The leaderboard's awards, worn as badges: whoever leads an award (MVP, Night Owl…) gets its
 * emoji beside their name around the workspace, and their hover card says what it's for and who's
 * close behind them. Worked out once per workspace from the same data as the Leaderboard page.
 */

/** An award someone leads. */
export type Badge = {emoji: string; title: string; stat: string};
/** An award someone is second or third in: how far behind the leader. */
export type Chase = {emoji: string; title: string; place: 2 | 3; behind: string; leader: string};
type PersonAwards = {badges: Badge[]; chasing: Chase[]};

const NONE: PersonAwards = {badges: [], chasing: []};
const AwardsContext = createContext<Map<string, PersonAwards> | null>(null);

/** How often badges catch up with the leaderboard. */
const REFRESH_MS = 2 * 60_000;

export function AwardsProvider({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const workspace = useWorkspace();
  const {data} = useQuery({
    ...orpc.workspaces.recap.queryOptions({input: {workspaceSlug}}),
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
  });
  const puzzles = useMemo(() => workspace.rounds.flatMap(round => round.puzzles), [workspace]);
  const byUser = useMemo(() => {
    const result = new Map<string, PersonAwards>();
    if (!data) return result;
    const solvedNow = new Set(puzzles.filter(p => isSolve(p.status)).map(p => p.id));
    const metaIds = new Set(puzzles.filter(p => p.isMetaPuzzle).map(p => p.id));
    const {awards, standings} = computeRecap(data, solvedNow, metaIds);
    const of = (id: string) => {
      let entry = result.get(id);
      if (!entry) result.set(id, (entry = {badges: [], chasing: []}));
      return entry;
    };
    for (const award of awards) {
      of(award.user.id).badges.push({emoji: award.emoji, title: award.title, stat: award.stat});
    }
    // Close behind: second and third in a race someone has won (a reason to keep going).
    for (const standing of standings) {
      const [leader, ...rest] = standing.ranked;
      if (!leader || !awards.some(a => a.title === standing.title)) continue;
      rest.slice(0, 2).forEach((entry, i) => {
        const gap = leader.value - entry.value;
        of(entry.user.id).chasing.push({
          emoji: standing.emoji,
          title: standing.title,
          place: i === 0 ? 2 : 3,
          behind: gap > 0 ? standing.short(gap) : "tied",
          leader: leader.user.name,
        });
      });
    }
    return result;
  }, [data, puzzles]);
  return <AwardsContext.Provider value={byUser}>{children}</AwardsContext.Provider>;
}

/** A person's badges and close races (nothing outside a workspace). */
export function useAwards(userId: string | null | undefined): PersonAwards {
  const byUser = useContext(AwardsContext);
  return (userId && byUser?.get(userId)) || NONE;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The emoji of each award someone leads, beside their name; hover one for what it's for. */
export function AwardBadges({
  userId,
  plain,
  className,
}: {
  userId: string | null | undefined;
  /** Just the emoji, no tooltips: inside something with its own hover card (a person chip). */
  plain?: boolean;
  className?: string;
}) {
  const {badges} = useAwards(userId);
  if (badges.length === 0) return null;
  if (plain) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center gap-0.5 leading-none", className)}
        aria-label={badges.map(badge => badge.title).join(", ")}>
        {badges.map(badge => (
          <span key={badge.title} aria-hidden="true">
            {badge.emoji}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)}>
      {badges.map(badge => (
        <Tooltip key={badge.title} delay={200}>
          <Tooltip.Trigger>
            <span
              role="img"
              aria-label={`${badge.title}: ${badge.stat}`}
              className="cursor-default text-[0.95em] leading-none">
              {badge.emoji}
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content className="flex max-w-60 flex-col gap-0.5">
            <span className="font-semibold">
              {badge.emoji} {badge.title}
            </span>
            <span className="text-muted">{capitalize(badge.stat)}, the most on the team.</span>
          </Tooltip.Content>
        </Tooltip>
      ))}
    </span>
  );
}

/** For a hover card: the awards someone leads, and the ones they're close to taking. */
export function AwardsSummary({userId}: {userId: string | null | undefined}) {
  const {badges, chasing} = useAwards(userId);
  if (badges.length === 0 && chasing.length === 0) return null;
  return (
    <ul className="border-separator flex flex-col gap-1.5 border-t pt-2 text-xs">
      {badges.map(badge => (
        <li key={badge.title} className="flex items-baseline gap-2">
          <span aria-hidden="true">{badge.emoji}</span>
          <span>
            <span className="text-foreground font-medium">{badge.title}</span>
            <span className="text-muted"> · {capitalize(badge.stat)}</span>
          </span>
        </li>
      ))}
      {chasing.map(chase => (
        <li key={chase.title} className="text-muted flex items-baseline gap-2">
          <span aria-hidden="true">{chase.place === 2 ? "🥈" : "🥉"}</span>
          <span>
            {chase.title}:{" "}
            {chase.behind === "tied"
              ? `tied with ${chase.leader}`
              : `${chase.behind} behind ${chase.leader}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
