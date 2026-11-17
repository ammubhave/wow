/**
 * Hunt listings from public puzzle hunt calendars (iCal feeds), kept in the hunt_listings table so
 * creating a workspace can suggest the hunt's name. A cron trigger (wrangler.jsonc) runs
 * syncHuntListings every few hours.
 */
import {and, eq, lt, sql} from "drizzle-orm";

import {db} from "@/lib/db";
import {huntListings} from "@/lib/db/schema";

import {parseHuntCalendar} from "./hunt-calendar-parse";

/** Puzzle Hunt Calendar (puzzlehuntcalendar.com, by Dan Egnor): its two Google calendars. */
const SOURCE = "puzzlehuntcalendar";
const FEEDS = [
  // Upcoming events.
  "https://calendar.google.com/calendar/ical/cisu3v9nei0eemvg3savaboonk%40group.calendar.google.com/public/basic.ics",
  // Ongoing and TBA.
  "https://calendar.google.com/calendar/ical/baqsf68kf5ebv2iscro7a6fumo%40group.calendar.google.com/public/basic.ics",
];

/** D1 allows 100 bound parameters per statement; a listing binds about 15 (with its ID). */
const ROWS_PER_INSERT = 6;

/**
 * Refreshes the synced listings: adds new events, updates changed ones, and removes ones the
 * calendar dropped. Listings added by hand, and whether a listing is hidden, are left alone. If a
 * feed can't be read, nothing is removed.
 */
export async function syncHuntListings() {
  const syncedAt = new Date();
  const feeds = await Promise.all(
    FEEDS.map(async url => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Hunt calendar ${url}: HTTP ${response.status}`);
      return parseHuntCalendar(await response.text());
    })
  );
  const listings = feeds.flat();
  if (listings.length === 0) throw new Error("Hunt calendars returned no events");

  const statements = [];
  for (let i = 0; i < listings.length; i += ROWS_PER_INSERT) {
    const rows = listings
      .slice(i, i + ROWS_PER_INSERT)
      .map(listing => Object.assign({source: SOURCE, syncedAt}, listing));
    statements.push(
      db
        .insert(huntListings)
        .values(rows)
        .onConflictDoUpdate({
          target: [huntListings.source, huntListings.sourceId],
          set: {
            name: sql`excluded.name`,
            note: sql`excluded.note`,
            url: sql`excluded.url`,
            location: sql`excluded.location`,
            isOnline: sql`excluded.isOnline`,
            allDay: sql`excluded.allDay`,
            startsAt: sql`excluded.startsAt`,
            endsAt: sql`excluded.endsAt`,
            syncedAt: sql`excluded.syncedAt`,
            updatedAt: syncedAt,
          },
        })
    );
  }
  statements.push(
    db
      .delete(huntListings)
      .where(and(eq(huntListings.source, SOURCE), lt(huntListings.syncedAt, syncedAt)))
  );
  const [first, ...rest] = statements;
  await db.batch([first!, ...rest]);
  return listings.length;
}
