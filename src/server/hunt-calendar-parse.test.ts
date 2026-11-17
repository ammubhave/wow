import {describe, expect, it} from "vite-plus/test";

import {parseHuntCalendar} from "./hunt-calendar-parse";

const feed = (...events: string[]) =>
  [
    "BEGIN:VCALENDAR",
    ...events.map(e => `BEGIN:VEVENT\r\n${e}\r\nEND:VEVENT`),
    "END:VCALENDAR",
  ].join("\r\n");

describe("parseHuntCalendar", () => {
  it("reads an all-day online hunt, its note and its link", () => {
    const [hunt] = parseHuntCalendar(
      feed(
        [
          "DTSTART;VALUE=DATE:20261212",
          "DTEND;VALUE=DATE:20261214",
          "UID:leo@google.com",
          "SUMMARY:Leo's 20th Birthday Bash (requires programming\\, cash prizes)",
          'DESCRIPTION:<a href="https://dmoj.ca/contest/leo20">https://dmoj.ca/contest/le',
          " o20</a><br> <br>Leo's 20th",
          "LOCATION:",
        ].join("\r\n")
      )
    );
    expect(hunt).toEqual({
      sourceId: "leo@google.com",
      name: "Leo's 20th Birthday Bash",
      note: "requires programming, cash prizes",
      url: "https://dmoj.ca/contest/leo20",
      location: null,
      isOnline: true,
      allDay: true,
      startsAt: new Date("2026-12-12T00:00:00Z"),
      endsAt: new Date("2026-12-14T00:00:00Z"),
    });
  });

  it("tells in-person from online, and takes a link given as the place", () => {
    const hunts = parseHuntCalendar(
      feed(
        "DTSTART;VALUE=DATE:20270320\r\nUID:a\r\nSUMMARY:WTJU Puzzle Hunt\r\nLOCATION:Charlottesville\\, VA",
        "DTSTART;VALUE=DATE:20270115\r\nUID:b\r\nSUMMARY:MIT Mystery Hunt 2027\r\nLOCATION:Cambridge\\, MA and online",
        "DTSTART;VALUE=DATE:20261114\r\nUID:c\r\nSUMMARY:Puzzle Boat 13\r\nLOCATION:https://www.pandamagazine.com/island13/"
      )
    );
    expect(hunts.map(h => [h.name, h.location, h.isOnline, h.url])).toEqual([
      ["WTJU Puzzle Hunt", "Charlottesville, VA", false, null],
      ["MIT Mystery Hunt 2027", "Cambridge, MA and online", true, null],
      ["Puzzle Boat 13", null, true, "https://www.pandamagazine.com/island13/"],
    ]);
  });

  it("converts times in a time zone, and skips edited occurrences", () => {
    const hunts = parseHuntCalendar(
      feed(
        "DTSTART;TZID=America/Los_Angeles:20261107T090000\r\nDTEND;TZID=America/Los_Angeles:20261107T170000\r\nUID:r\r\nSUMMARY:Rallye",
        "DTSTART:20261108T120000Z\r\nUID:r\r\nRECURRENCE-ID:20261108\r\nSUMMARY:Rallye (moved)"
      )
    );
    expect(hunts).toHaveLength(1);
    expect(hunts[0]).toMatchObject({
      allDay: false,
      startsAt: new Date("2026-11-07T17:00:00Z"),
      endsAt: new Date("2026-11-08T01:00:00Z"),
    });
  });

  it("unwraps Google's redirect links", () => {
    const [hunt] = parseHuntCalendar(
      feed(
        [
          "DTSTART;VALUE=DATE:20261226",
          "UID:h",
          "SUMMARY:Holiday Hoopla",
          String.raw`DESCRIPTION:<a href="https://www.google.com/url?q=https://vitamincsquad.com/&amp\;sa=D">x</a>`,
        ].join("\r\n")
      )
    );
    expect(hunt?.url).toBe("https://vitamincsquad.com/");
  });
});
