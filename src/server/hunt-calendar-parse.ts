/** Parses puzzle hunt calendars (iCal feeds) into hunt listings. See hunt-calendar.ts. */

export type HuntListingInput = {
  sourceId: string;
  name: string;
  note: string | null;
  url: string | null;
  location: string | null;
  isOnline: boolean;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
};

/** iCal text values escape commas, semicolons, backslashes and newlines. */
const unescapeText = (value: string) =>
  value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === "n" || ch === "N" ? "\n" : ch));

/** The UTC instant of a wall-clock time in an IANA time zone. */
type DateParts = [
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
];

function zonedTime(
  [year, month, day, hour, minute, second]: DateParts,
  timeZone: string
): Date | null {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    }).formatToParts(new Date(asUtc));
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    const shown = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    );
    // The zone's offset at that moment, applied the other way.
    return new Date(asUtc - (shown - asUtc));
  } catch {
    return null;
  }
}

/** A DTSTART/DTEND value: a date (all day), a UTC time, or a time in a TZID (else UTC). */
function parseDate(params: string, value: string): {date: Date; allDay: boolean} | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const n = (i: number) => Number(m[i] ?? 0);
  const nums: DateParts = [n(1), n(2), n(3), n(4), n(5), n(6)];
  const [year, month, day, hour, minute, second] = nums;
  if (m[4] === undefined) return {date: new Date(Date.UTC(year, month - 1, day)), allDay: true};
  const tzid = params.match(/;TZID=([^;:]+)/)?.[1];
  const date =
    tzid && !m[7]
      ? zonedTime(nums, tzid)
      : new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date ? {date, allDay: false} : null;
}

/** Google Calendar wraps some links in a redirect: unwrap it. */
function unwrapLink(link: string) {
  try {
    const url = new URL(link.replace(/&amp;/g, "&"));
    if (url.hostname.endsWith("google.com") && url.pathname === "/url") {
      return url.searchParams.get("q") ?? link;
    }
    return url.toString();
  } catch {
    return null;
  }
}

const firstLink = (text: string) => {
  const found = text.match(/https?:\/\/[^\s"'<>\\]+/)?.[0];
  return found ? unwrapLink(found) : null;
};

/**
 * Parses an iCal feed into hunt listings. Only each event's own dates are used (no repeat rules:
 * the calendars' repeating events are all long past), and edited copies of single occurrences are
 * skipped.
 */
export function parseHuntCalendar(ics: string): HuntListingInput[] {
  // Long lines are folded onto continuation lines that start with a space or tab.
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const listings = new Map<string, HuntListingInput>();
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const fields = new Map<string, {params: string; value: string}>();
    for (const line of block.split("END:VEVENT")[0]!.split(/\r?\n/)) {
      const m = line.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/);
      if (m && !fields.has(m[1]!)) fields.set(m[1]!, {params: m[2]!, value: m[3]!});
    }
    if (fields.has("RECURRENCE-ID") || fields.get("STATUS")?.value === "CANCELLED") continue;
    const uid = fields.get("UID")?.value;
    const summary = unescapeText(fields.get("SUMMARY")?.value ?? "").trim();
    const start = fields.get("DTSTART");
    const startsAt = start && parseDate(start.params, start.value);
    if (!uid || !summary || !startsAt) continue;
    const end = fields.get("DTEND");
    const endsAt = (end && parseDate(end.params, end.value)) ?? startsAt;

    const rawLocation = unescapeText(fields.get("LOCATION")?.value ?? "").trim();
    const locationIsLink = /^https?:\/\//.test(rawLocation);
    const location = rawLocation && !locationIsLink ? rawLocation : null;
    const description = unescapeText(fields.get("DESCRIPTION")?.value ?? "");
    // "Name (a note)": the note is the calendar's aside, not part of the hunt's name.
    const noted = summary.match(/^(.*\S)\s*\(([^()]*)\)$/);
    const name = noted ? noted[1]! : summary;
    const note = noted ? noted[2]! : null;
    listings.set(uid, {
      sourceId: uid,
      name,
      note,
      url: (locationIsLink ? unwrapLink(rawLocation) : null) ?? firstLink(description),
      location,
      // No place given, a link as the place, or "online" said anywhere: solvable online.
      isOnline: !location || /\bonline\b/i.test(`${rawLocation} ${summary}`),
      allDay: startsAt.allDay,
      startsAt: startsAt.date,
      endsAt: endsAt.date,
    });
  }
  return [...listings.values()];
}
