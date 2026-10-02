// Fills a LOCAL dev workspace's activity log with a believable hunt weekend: rounds unlocking over
// time, teammates opening puzzles, getting stuck, entering answers and solving them (fast at first,
// slower overnight, metas late), so the activity feed and the solves chart look like a real run.
// Only puzzles' current statuses are respected; nothing else in the workspace is changed.
//
// Usage: pnpm db:seed:activity [workspaceSlug]   (default: hi)
//
// Safe to re-run: everything it adds has a `dev-` id and is replaced, not duplicated. Only ever
// touches the local D1 (`--local`), never production.
import {execFileSync} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

const slug = process.argv[2] ?? "hi";

const d1 = args =>
  execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "wow", "--local", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
const query = sql => JSON.parse(d1(["--json", "--command", sql]))[0].results;
const quote = value => (value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`);

const [workspace] = query(`SELECT id FROM organization WHERE slug = ${quote(slug)}`);
if (!workspace) throw new Error(`No workspace with slug "${slug}" in the local database.`);
const rounds = query(
  `SELECT id, name FROM round WHERE workspaceId = ${quote(workspace.id)} ORDER BY createdAt, id`
);
const puzzles = query(
  `SELECT p.id, p.name, p.roundId, p.status, p.answer, p.isMetaPuzzle, p.parentPuzzleId FROM puzzle p
   JOIN round r ON r.id = p.roundId WHERE r.workspaceId = ${quote(workspace.id)} ORDER BY p.createdAt, p.id`
);

// A deterministic generator, so re-running gives the same weekend.
let seed = 0x5eed;
const random = () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};
const pick = items => items[Math.floor(random() * items.length)];
// Log-normal: most puzzles take a couple of hours, a few take much longer.
const duration = medianHours => medianHours * 3_600_000 * Math.exp((random() * 2 - 1) * 0.9);

const HOUR = 3_600_000;
const end = Date.now() - 20 * 60_000;
const start = end - 66 * HOUR;

// Overnight (2am–9am) the team is a third as productive; work time is stretched to match.
const asleep = time => {
  const hour = new Date(time).getHours();
  return hour >= 2 && hour < 9;
};
const after = (from, work) => {
  let time = from;
  let left = work;
  while (left > 0) {
    const step = Math.min(left, 10 * 60_000);
    time += asleep(time) ? step * 3 : step;
    left -= step;
  }
  return Math.min(time, end - Math.floor(random() * 30 * 60_000));
};

const TEAMMATES = [
  "Priya Raman",
  "Jonah Feld",
  "Mei Tanaka",
  "Sam Okafor",
  "Lena Kowalski",
  "Diego Alvarez",
  "Hana Kim",
  "Theo Brandt",
];
const statements = [
  // Replace what an earlier run added (children first, in case foreign keys aren't enforced).
  `DELETE FROM puzzle_activity_log_entry WHERE activityLogEntryId LIKE 'dev-act-%';`,
  `DELETE FROM round_activity_log_entry WHERE activityLogEntryId LIKE 'dev-act-%';`,
  `DELETE FROM workspace_activity_log_entry WHERE activityLogEntryId LIKE 'dev-act-%';`,
  `DELETE FROM activity_log_entry WHERE id LIKE 'dev-act-%';`,
];
const teammateIds = TEAMMATES.map((name, i) => {
  const id = `dev-user-${i + 1}`;
  const email = `${name.split(" ")[0].toLowerCase()}@example.test`;
  statements.push(
    `INSERT OR REPLACE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (${quote(id)}, ${quote(name)}, ${quote(email)}, 1, ${start - 48 * HOUR}, ${start - 48 * HOUR});`,
    `INSERT OR REPLACE INTO member (id, organization_id, user_id, role, created_at) VALUES (${quote(`dev-member-${i + 1}`)}, ${quote(workspace.id)}, ${quote(id)}, 'member', ${start - 48 * HOUR});`
  );
  return id;
});
const members = [
  ...query(`SELECT user_id FROM member WHERE organization_id = ${quote(workspace.id)}`).map(
    member => member.user_id
  ),
  ...teammateIds,
];
const people = [...new Set(members)];

let n = 0;
const log = (time, userId, child) => {
  const id = `dev-act-${String(++n).padStart(5, "0")}`;
  const t = Math.round(Math.min(time, end));
  statements.push(
    `INSERT INTO activity_log_entry (id, createdAt, updatedAt, workspaceId, userId) VALUES (${quote(id)}, ${t}, ${t}, ${quote(workspace.id)}, ${quote(userId)});`
  );
  statements.push(child(id));
};
const puzzleEvent = (time, userId, puzzle, subType, field) =>
  log(
    time,
    userId,
    id =>
      `INSERT INTO puzzle_activity_log_entry (activityLogEntryId, subType, puzzleId, puzzleName, field) VALUES (${quote(id)}, ${quote(subType)}, ${quote(puzzle.id)}, ${quote(puzzle.name)}, ${quote(field)});`
  );

// Teammates join just before kickoff.
teammateIds.forEach(userId =>
  log(
    start - random() * 3 * HOUR,
    userId,
    id =>
      `INSERT INTO workspace_activity_log_entry (activityLogEntryId, subType) VALUES (${quote(id)}, 'join');`
  )
);

const isSolved = status => status === "solved" || status === "backsolved";
const solvedAt = new Map();
// Puzzles unlock steadily through the first ~80% of the hunt (as solves open new ones), in
// round order; a round appears when its first puzzle does.
const unlockAt = new Map(
  puzzles
    .toSorted(
      (a, b) =>
        rounds.findIndex(r => r.id === a.roundId) - rounds.findIndex(r => r.id === b.roundId) ||
        a.isMetaPuzzle - b.isMetaPuzzle
    )
    .map((puzzle, k) => [
      puzzle.id,
      start + (k / puzzles.length) ** 1.15 * 0.8 * (end - start) + random() * 30 * 60_000,
    ])
);
rounds.forEach(round => {
  const roundPuzzles = puzzles.filter(puzzle => puzzle.roundId === round.id);
  const unlock = Math.min(...roundPuzzles.map(puzzle => unlockAt.get(puzzle.id)), end);
  const admin = people[0];
  log(
    unlock - 60_000,
    admin,
    id =>
      `INSERT INTO round_activity_log_entry (activityLogEntryId, subType, roundId, roundName) VALUES (${quote(id)}, 'create', ${quote(round.id)}, ${quote(round.name)});`
  );
  // Feeders first, so metas can be timed after them.
  for (const puzzle of roundPuzzles.toSorted((a, b) => a.isMetaPuzzle - b.isMetaPuzzle)) {
    const opened = unlockAt.get(puzzle.id);
    puzzleEvent(opened, admin, puzzle, "create", null);
    const solver = pick(people);
    const started = after(opened, random() * 1.5 * HOUR);
    puzzleEvent(started, solver, puzzle, "updateStatus", "active");

    let solveTime;
    if (puzzle.isMetaPuzzle) {
      // A meta falls once most of its feeders are in.
      const feeders = roundPuzzles
        .filter(p => p.parentPuzzleId === puzzle.id || (!p.isMetaPuzzle && !p.parentPuzzleId))
        .map(p => solvedAt.get(p.id))
        .filter(Boolean)
        .toSorted((a, b) => a - b);
      const mostly = feeders[Math.floor(feeders.length * 0.75)] ?? started;
      solveTime = after(Math.max(mostly, started), duration(1.5));
    } else {
      solveTime = after(started, duration(2.5));
    }

    if (random() < 0.25) {
      const stuck = started + (solveTime - started) * (0.4 + random() * 0.3);
      puzzleEvent(stuck, pick(people), puzzle, "updateStatus", "stuck");
    }
    if (random() < 0.15) {
      puzzleEvent(
        started + (solveTime - started) * 0.5,
        solver,
        puzzle,
        "updateImportance",
        "important"
      );
    }
    if (isSolved(puzzle.status)) {
      solvedAt.set(puzzle.id, solveTime);
      if (puzzle.answer)
        puzzleEvent(solveTime - 60_000, solver, puzzle, "updateAnswer", puzzle.answer);
      puzzleEvent(solveTime, solver, puzzle, "updateStatus", puzzle.status);
    } else if (puzzle.status && puzzle.status !== "active") {
      puzzleEvent(after(started, duration(2)), pick(people), puzzle, "updateStatus", puzzle.status);
    }
  }
});

const file = join(mkdtempSync(join(tmpdir(), "seed-activity-")), "seed.sql");
writeFileSync(file, statements.join("\n"));
d1(["--file", file]);
console.log(
  `Seeded ${n} activity log entries (${solvedAt.size} solves) and ${TEAMMATES.length} teammates into "${slug}".`
);
