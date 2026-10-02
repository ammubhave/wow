import {Link} from "@tanstack/react-router";
import {cn} from "tailwind-variants";

import {huntDate, splitHuntName} from "@/lib/exchange-hunts";
import {monthColors} from "@/lib/month-colors";

import {Grainient} from "./grainient";

/**
 * A Puzzle Exchange month's "cover", like a magazine issue's: its colours as a slowly moving
 * grainy gradient, the issue number and the month in large type. With `linkToHunt`, the whole
 * cover opens the hunt (the title link is stretched over it); `children` (e.g. puzzle links) sit
 * above that and stay clickable.
 */
export function ExchangeCover({
  hunt,
  issue,
  badge,
  linkToHunt = false,
  children,
}: {
  hunt: {id: string; name: string; createdAt: Date | string};
  issue?: number;
  badge?: string;
  linkToHunt?: boolean;
  children?: React.ReactNode;
}) {
  const {title, year} = splitHuntName(hunt.name);
  const heading = (
    <>
      <span
        className={cn(
          "text-5xl font-bold tracking-tight md:text-6xl",
          linkToHunt && "group-hover:underline"
        )}>
        {title}
      </span>
      {year && <span className="text-lg text-white/80 tabular-nums">{year}</span>}
    </>
  );
  return (
    <section className="group relative isolate overflow-hidden rounded-3xl text-white">
      <Grainient colors={monthColors(huntDate(hunt))} className="absolute inset-0 -z-10" />
      {/* Keeps white text readable on the lightest parts of any month's gradient. */}
      <div
        className={cn(
          "absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/35 to-black/10",
          linkToHunt && "transition-opacity group-hover:opacity-80"
        )}
      />
      <div className="flex min-h-72 flex-col justify-between gap-8 p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="text-sm font-medium text-white/80 tabular-nums">
            {issue !== undefined && `No. ${issue}`}
          </span>
          {badge && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              {badge}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-5">
          {linkToHunt ? (
            <Link
              to="/exchange/hunts/$huntId"
              params={{huntId: hunt.id}}
              className="flex w-fit flex-col after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-white">
              {heading}
            </Link>
          ) : (
            <h1 className="flex w-fit flex-col">{heading}</h1>
          )}
          {children && <div className="relative z-10">{children}</div>}
        </div>
      </div>
    </section>
  );
}
