// Fills the LOCAL dev database with sample Puzzle Exchange hunts and puzzles (content, hints,
// partial answers and solutions), so every Exchange page has something to show.
//
// Usage: pnpm db:seed:exchange
//
// Safe to re-run: rows have fixed `dev-` ids and are replaced, not duplicated. Only ever touches
// the local D1 (`--local`), never production.
import {execFileSync} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const doc = (...paragraphs) => ({
  type: "doc",
  content: paragraphs.map(text => ({type: "paragraph", content: [{type: "text", text}]})),
});

// [month name, year, puzzles]; a puzzle is [title, answer, flavour, hints, partials].
const HUNTS = [
  [
    "October",
    2025,
    [
      [
        "Haunted Grid",
        "GHOST",
        "Every row hides a spirit.",
        [["Start here", "Read the first letters of each row."]],
        [],
      ],
      [
        "Pumpkin Patch",
        "LANTERN",
        "Carve carefully.",
        [],
        [["PUMPKIN", "Right theme, wrong word."]],
      ],
    ],
  ],
  [
    "November",
    2025,
    [
      [
        "Leaf Pile",
        "AUTUMN",
        "Some leaves fall in order.",
        [["Nudge", "Sort the leaves by colour."]],
        [],
      ],
      ["Gratitude List", "THANKS", "A list worth reading twice.", [], []],
      [
        "Cold Front",
        "FROST",
        "The forecast is cryptic.",
        [["Nudge", "Each clue is a weather pun."]],
        [["SNOW", "Close, but colder and thinner."]],
      ],
    ],
  ],
  [
    "December",
    2025,
    [
      ["Gift Wrap", "RIBBON", "Unwrap the clues one layer at a time.", [], []],
      [
        "Snow Globe",
        "WINTER",
        "Shake it up and see what settles.",
        [["Nudge", "The falling letters land in alphabetical order."]],
        [],
      ],
    ],
  ],
  [
    "January",
    2026,
    [
      [
        "Fresh Start",
        "BEGIN",
        "Every answer is a first.",
        [["Nudge", "Think about openings: chess, books, races."]],
        [],
      ],
      ["Resolutions", "GOALS", "Ten promises, one theme.", [], [["PLANS", "On the right track."]]],
      ["Ice Rink", "SKATE", "Glide from clue to clue.", [], []],
    ],
  ],
  [
    "April",
    2026,
    [
      [
        "Rain Check",
        "SHOWER",
        "April has its reasons.",
        [["Nudge", "Each picture is a kind of rain."]],
        [],
      ],
      [
        "Fool's Errand",
        "PRANK",
        "Nothing here is what it seems.",
        [],
        [["JOKE", "Funny, but not quite."]],
      ],
    ],
  ],
  [
    "May",
    2026,
    [
      [
        "Garden Party",
        "BLOOM",
        "Plant the right seeds.",
        [["Nudge", "Match each flower to its month."]],
        [],
      ],
      ["Maypole", "RIBBONS", "Weave the strands together.", [], []],
      ["Bee Line", "HONEY", "Follow the straightest path.", [], []],
    ],
  ],
  [
    "June",
    2026,
    [
      ["Solstice", "SUMMER", "The longest day has the longest answer.", [], []],
      [
        "Beach Day",
        "SHELLS",
        "Look under every grain of sand.",
        [["Nudge", "Count the letters in each beach name."]],
        [["SAND", "Dig a little deeper."]],
      ],
    ],
  ],
  [
    "July",
    2026,
    [
      [
        "Fireworks",
        "SPARKLE",
        "Light the fuses in order.",
        [["Nudge", "Each colour is a chemical element."]],
        [],
      ],
      ["Heatwave", "SCORCH", "Things are heating up.", [], []],
      [
        "Picnic Basket",
        "SANDWICH",
        "Pack it the right way.",
        [],
        [["LUNCH", "Close: be more specific."]],
      ],
    ],
  ],
  [
    "August",
    2026,
    [
      [
        "Back to School",
        "LESSON",
        "Every subject has a secret.",
        [["Nudge", "Read the timetable diagonally."]],
        [],
      ],
      ["Dog Days", "HOUND", "The hottest days of summer.", [], []],
    ],
  ],
  [
    "September",
    2026,
    [
      [
        "Harvest Moon",
        "AMBER",
        "Gather what the moon reveals.",
        [["Nudge", "Each phase hides a letter."]],
        [],
      ],
      [
        "Apple Picking",
        "ORCHARD",
        "Pick only the ripe ones.",
        [],
        [["APPLE", "Think about where they grow."]],
      ],
      ["Labor Day Relay", "BATON", "Pass it along, leg by leg.", [], []],
      [
        "Sum Odd Thing",
        "SEVEN",
        "The numbers don't quite add up.",
        [["Nudge", "Only the odd numbers matter."]],
        [],
      ],
    ],
  ],
];

const quote = value => (value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);
const json = value => quote(JSON.stringify(value));

const statements = [];
for (const [month, year, puzzles] of HUNTS) {
  // Created a few days before the month starts, like real hunts.
  const createdAt =
    new Date(
      year,
      [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ].indexOf(month),
      1
    ).getTime() -
    3 * 86_400_000;
  const huntId = `dev-hunt-${String(year)}-${String(month).toLowerCase()}`;
  statements.push(
    `INSERT OR REPLACE INTO hunts (id, createdAt, updatedAt, draft, name) VALUES (${quote(huntId)}, ${String(createdAt)}, ${String(createdAt)}, 0, ${quote(`${String(month)} ${String(year)}`)});`
  );
  puzzles.forEach(([title, answer, flavour, hints, partials], i) => {
    const contents = doc(
      flavour,
      "This is sample puzzle content for local development.",
      `(The answer is ${answer.length} letters.)`
    );
    const solution = doc(
      `The answer is ${answer}.`,
      "This is a sample solution for local development."
    );
    statements.push(
      `INSERT OR REPLACE INTO hunt_puzzles (id, createdAt, updatedAt, huntId, draft, title, contents, answer, partials, hints, solution) VALUES (${quote(`${huntId}-${i + 1}`)}, ${createdAt}, ${createdAt}, ${quote(huntId)}, 0, ${quote(title)}, ${json(contents)}, ${quote(answer)}, ${json(partials.map(([a, message]) => ({answer: a, message})))}, ${json(hints.map(([t, message]) => ({title: t, message})))}, ${json(solution)});`
    );
  });
}

const file = join(mkdtempSync(join(tmpdir(), "seed-exchange-")), "seed.sql");
writeFileSync(file, statements.join("\n"));
execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "wow", "--local", "--file", file], {
  stdio: ["ignore", "ignore", "inherit"],
});
const puzzleCount = HUNTS.reduce((sum, [, , puzzles]) => sum + puzzles.length, 0);
console.log(`Seeded ${HUNTS.length} hunts and ${puzzleCount} puzzles into the local database.`);
