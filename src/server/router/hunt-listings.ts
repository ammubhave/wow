import {and, asc, count, eq, gt, gte, isNotNull, lt} from "drizzle-orm";
import {z} from "zod";

import {db} from "@/lib/db";
import {huntListings, member, organization} from "@/lib/db/schema";

import {syncHuntListings} from "../hunt-calendar";
import {captureServerException} from "../posthog";
import {procedure} from "./base";

/** Hunts that ended this recently are still suggested (a team may set up just after). */
const RECENTLY_ENDED_MS = 3 * 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead "for you" looks: teams set up a few weeks before a hunt at most… */
const FOR_YOU_AHEAD_DAYS = 45;
/** …or months ahead for a series they (or other teams on WOW) have played before. */
const FOR_YOU_SERIES_AHEAD_DAYS = 120;
// One featured, then two rows of two.
const FOR_YOU_COUNT = 5;

/** A name to compare by: lowercase letters and digits only. */
const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
/** The hunt's series: its name without the year or edition number ("mitmysteryhunt"). */
const series = (name: string) => normalize(name).replace(/[0-9]/g, "");
/** One name contains the other (and isn't too short to mean anything). */
const overlaps = (a: string, b: string) =>
  Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a));

/**
 * Before the first cron run (a fresh database, a new deploy), fills the table now, so whichever
 * of the hunt lists is opened first has hunts to show.
 */
async function fillIfEmpty() {
  const [{rows} = {rows: 0}] = await db.select({rows: count()}).from(huntListings);
  if (rows > 0) return;
  await syncHuntListings().catch((error: unknown) => {
    console.error("Hunt listings sync failed:", error);
    captureServerException(error, {properties: {task: "hunt listings sync"}});
  });
}

export const huntListingsRouter = {
  /** Ongoing and upcoming hunts (online and in person), soonest first: event name suggestions. */
  current: procedure.handler(async () => {
    await fillIfEmpty();
    return db
      .select({
        id: huntListings.id,
        name: huntListings.name,
        note: huntListings.note,
        url: huntListings.url,
        location: huntListings.location,
        isOnline: huntListings.isOnline,
        allDay: huntListings.allDay,
        startsAt: huntListings.startsAt,
        endsAt: huntListings.endsAt,
      })
      .from(huntListings)
      .where(
        and(
          eq(huntListings.hidden, false),
          gte(huntListings.endsAt, new Date(Date.now() - RECENTLY_ENDED_MS))
        )
      )
      .orderBy(asc(huntListings.startsAt))
      .limit(200);
  }),

  /**
   * The few hunts you're most likely to want a workspace for next, best first: ongoing or starting
   * in the next few weeks (months, for a series you or other teams have played), and not one you
   * already have a workspace for. Likelier: a series you've played, sooner, online (anyone can
   * play), and ones other teams on WOW play (this one, or past years').
   */
  forYou: procedure.handler(async ({context}) => {
    await fillIfEmpty();
    const now = Date.now();
    const [listings, mine, all] = await Promise.all([
      db
        .select()
        .from(huntListings)
        .where(
          and(
            eq(huntListings.hidden, false),
            gte(huntListings.endsAt, new Date(now)),
            lt(huntListings.startsAt, new Date(now + FOR_YOU_SERIES_AHEAD_DAYS * DAY_MS))
          )
        ),
      db
        .select({eventName: organization.eventName})
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(eq(member.userId, context.session.user.id)),
      db
        .select({eventName: organization.eventName, teams: count()})
        .from(organization)
        .where(isNotNull(organization.eventName))
        .groupBy(organization.eventName),
    ]);
    const myEventNames = mine.flatMap(({eventName}) => (eventName ? [eventName] : []));
    const myEvents = myEventNames.map(normalize);
    const mySeries = myEventNames.map(series);
    const events = all.flatMap(({eventName, teams}) => (eventName ? [{eventName, teams}] : []));

    return listings
      .filter(listing => !myEvents.some(event => overlaps(event, normalize(listing.name))))
      .map(listing => {
        const name = normalize(listing.name);
        const teams = events
          .filter(event => overlaps(normalize(event.eventName), name))
          .reduce((sum, event) => sum + event.teams, 0);
        const seriesTeams = events
          .filter(event => overlaps(series(event.eventName), series(listing.name)))
          .reduce((sum, event) => sum + event.teams, 0);
        // A series you've played (last year's Mystery Hunt, say) is the strongest sign.
        const played = mySeries.some(event => overlaps(event, series(listing.name)));
        const startsIn = (listing.startsAt.getTime() - now) / DAY_MS;
        if (startsIn > FOR_YOU_AHEAD_DAYS && !played && seriesTeams === 0) return null;
        // Lower is likelier: days to go (a long-running hunt counts its age a little against it),
        // less for popularity, more if you'd have to be there in person.
        const score =
          (startsIn >= 0 ? startsIn : -startsIn / 4) +
          (listing.isOnline ? 0 : 30) -
          8 * Math.log1p(seriesTeams) -
          15 * Math.log1p(teams) -
          (played ? 60 : 0);
        // Happening now is a strong sign too (it's the one to act on).
        return {listing, teams, score: score - (startsIn <= 0 ? 20 : 0)};
      })
      .filter(ranked => ranked !== null)
      .toSorted((a, b) => a.score - b.score)
      .slice(0, FOR_YOU_COUNT)
      .map(({listing, teams}) => ({
        id: listing.id,
        name: listing.name,
        note: listing.note,
        url: listing.url,
        location: listing.location,
        isOnline: listing.isOnline,
        allDay: listing.allDay,
        startsAt: listing.startsAt,
        endsAt: listing.endsAt,
        /** Workspaces on WOW for this hunt already. */
        teams,
      }));
  }),

  /**
   * Every hunt running at some point in [from, to) (ms), soonest first, for the All hunts page:
   * with how many WOW teams have a workspace for each, and yours, if you have one.
   */
  range: procedure
    .input(z.object({from: z.number(), to: z.number()}))
    .handler(async ({context, input}) => {
      await fillIfEmpty();
      const [listings, mine, all] = await Promise.all([
        db
          .select()
          .from(huntListings)
          .where(
            and(
              eq(huntListings.hidden, false),
              gt(huntListings.endsAt, new Date(input.from)),
              lt(huntListings.startsAt, new Date(input.to))
            )
          )
          .orderBy(asc(huntListings.startsAt))
          .limit(500),
        db
          .select({eventName: organization.eventName, slug: organization.slug})
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .where(eq(member.userId, context.session.user.id)),
        db
          .select({eventName: organization.eventName, teams: count()})
          .from(organization)
          .where(isNotNull(organization.eventName))
          .groupBy(organization.eventName),
      ]);
      return listings.map(listing => {
        const name = normalize(listing.name);
        return {
          id: listing.id,
          name: listing.name,
          note: listing.note,
          url: listing.url,
          location: listing.location,
          isOnline: listing.isOnline,
          allDay: listing.allDay,
          startsAt: listing.startsAt,
          endsAt: listing.endsAt,
          /** Workspaces on WOW for this hunt. */
          teams: all
            .filter(event => event.eventName && overlaps(normalize(event.eventName), name))
            .reduce((sum, event) => sum + event.teams, 0),
          /** Your workspace for it, if you have one. */
          mySlug:
            mine.find(event => event.eventName && overlaps(normalize(event.eventName), name))
              ?.slug ?? null,
        };
      });
    }),
};
