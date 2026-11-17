import {useQuery} from "@tanstack/react-query";

import type {Suggestion} from "@/components/form";
import {dateAt, toLocalInput} from "@/lib/datetime-local";
import {orpc} from "@/lib/orpc";
import type {RouterOutputs} from "@/server/router";

export type Listing = RouterOutputs["huntListings"]["current"][number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Nov 27", or "Nov 27, 2027" outside this year; all-day dates are UTC midnights. */
function day(date: Date, allDay: boolean) {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: allDay ? "UTC" : undefined,
  });
}

/** When it runs: "Nov 27 – Nov 29", "Jan 14", "Until Nov 30" once started, or "Ended Nov 14". */
export function when(listing: Listing) {
  // An all-day end is exclusive (the day after the last day).
  const last = listing.allDay ? new Date(listing.endsAt.getTime() - DAY_MS) : listing.endsAt;
  const end = day(last, listing.allDay);
  if (listing.endsAt.getTime() <= Date.now()) return `Ended ${end}`;
  if (listing.startsAt.getTime() <= Date.now()) return `Until ${end}`;
  const start = day(listing.startsAt, listing.allDay);
  return start === end ? start : `${start} – ${end}`;
}

/** Where: the place (which says "and online" when it's both), or "Online". */
export const where = (listing: Listing) => listing.location ?? (listing.isOnline ? "Online" : null);

/**
 * A hunt's dates and place as workspace form values. Calendars give most hunts as whole days, so
 * those run from the first day's start to the last day's end (owners can set exact times).
 */
export function huntDetails(listing: Listing) {
  return {
    huntStartsAt: listing.allDay
      ? dateAt(listing.startsAt, "00:00")
      : toLocalInput(listing.startsAt),
    huntEndsAt: listing.allDay
      ? dateAt(new Date(listing.endsAt.getTime() - DAY_MS), "23:59")
      : toLocalInput(listing.endsAt),
    huntLocation: where(listing) ?? "",
  };
}

/** A hunt's link, as a workspace link (shown in the workspace's header). */
export const huntWebsiteLink = (url: string) => ({name: "Hunt website", url});

/**
 * Ongoing and upcoming puzzle hunts (from the hunt calendars), as suggestions for an event name,
 * and the listings behind them by id. Empty until they load, or if they can't: the field works
 * without them.
 */
export function useHuntSuggestions(): {suggestions: Suggestion[]; byId: Map<string, Listing>} {
  const {data} = useQuery({...orpc.huntListings.current.queryOptions(), staleTime: 60 * 60 * 1000});
  const listings = data ?? [];
  return {
    suggestions: listings.map(listing => ({
      id: listing.id,
      text: listing.name,
      detail: [when(listing), where(listing), listing.note].filter(Boolean).join(" · "),
    })),
    byId: new Map(listings.map(listing => [listing.id, listing])),
  };
}
