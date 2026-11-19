// Seeds the demo workspace the docs' screenshots are taken in: "The Red Herrings" playing
// "Example Hunt 2027", mid-hunt, with rounds, metas, feeders, answers, guesses, teammates, solver
// credit and puzzle time. LOCAL DEV ONLY: it signs in as the dev test account
// (.wrangler/dev-test-account.json) on the local dev server, and writes to the local D1 file.
//
// Usage: (dev server on :3124) node scripts/seed-docs-demo.mjs
// Re-running replaces the workspace.
import {readFileSync} from "node:fs";

import {createClient} from "@libsql/client";

const BASE = process.env.BASE ?? "http://localhost:3124";
const SLUG = "red-herrings";
const DB =
  "file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/722596595d721d84ff41d8d4d2f284f98b54fb861431dc96221983537ebe2989.sqlite";
const db = createClient({url: DB});

// Teammates (local dev users).
const TEAM = ["dev-user-1", "dev-user-2", "dev-user-3", "dev-user-4", "dev-user-5", "dev-user-8"];

const account = JSON.parse(readFileSync(".wrangler/dev-test-account.json", "utf8"));
const headers = {"content-type": "application/json", origin: BASE};
const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers,
  body: JSON.stringify({email: account.email, password: account.password}),
});
if (!signIn.ok) throw new Error(`Sign-in failed: ${signIn.status}`);
const cookie = signIn.headers
  .getSetCookie()
  .map(c => c.split(";")[0])
  .join("; ");
const auth = {...headers, cookie};

async function rpc(path, input) {
  const response = await fetch(`${BASE}/api/rpc/${path}`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({json: input}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body?.json;
}

// Start over.
const existing = (await db.execute("select id from organization where slug = ?", [SLUG])).rows[0];
if (existing) {
  await db.execute("PRAGMA foreign_keys=ON");
  await db.execute("delete from member where organization_id = ?", [existing.id]);
  await db.execute("delete from organization where id = ?", [existing.id]);
}

const HOUR = 3_600_000;
const now = Date.now();
const created = await fetch(`${BASE}/api/auth/organization/create`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({
    name: "The Red Herrings - Example Hunt 2027",
    slug: SLUG,
    teamName: "The Red Herrings",
    eventName: "Example Hunt 2027",
    password: "docs-demo-password",
    huntLocation: "Online",
    links: [{name: "Hunt website", url: "https://example.com/hunt"}],
  }),
});
if (!created.ok) throw new Error(`Create failed: ${created.status} ${await created.text()}`);
const org = (await db.execute("select id from organization where slug = ?", [SLUG])).rows[0];
const workspaceId = org.id;

await rpc("workspaces/update", {
  workspaceSlug: SLUG,
  huntStartsAt: now - 20 * HOUR,
  huntEndsAt: now + 28 * HOUR,
  emoji: "🐟",
  tags: ["crossword", "wordplay", "logic", "music", "cipher", "physical"],
  comment:
    "**Hunt HQ notes**\n\n- Answers are called in by **Mei** (guess queue).\n- Lighthouse meta looks like an NTH extraction.\n- Lunch break at 1pm, the lobby call stays open.",
});

// Teammates join.
for (const [i, userId] of TEAM.entries()) {
  await db.execute(
    "insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)",
    [`demo-member-${i}`, workspaceId, userId, i === 2 ? "owner" : "member", now - 30 * HOUR]
  );
}

const round = name => rpc("rounds/create", {workspaceSlug: SLUG, name});
const puzzle = (fields, where) =>
  rpc("puzzles/create", {
    workspaceSlug: SLUG,
    type: "puzzle",
    tags: [],
    link: "",
    worksheetType: "google_spreadsheet",
    ...where,
    ...fields,
  });
const meta = (name, roundId) =>
  rpc("puzzles/create", {
    workspaceSlug: SLUG,
    type: "meta-puzzle",
    roundId,
    assignUnassignedPuzzles: false,
    name,
    tags: [],
    link: "",
    worksheetType: "google_spreadsheet",
  });
const update = (id, fields) => rpc("puzzles/update", {workspaceSlug: SLUG, id, ...fields});

// Round 1: The Lighthouse.
const lighthouse = await round("The Lighthouse");
const keepersLog = await meta("Keeper's Log", lighthouse.id);
const lighthouseFeeders = [
  ["Foghorn Fugue", ["music"], "HARBOR", "solved"],
  ["Beacon Crossing", ["crossword"], "LANTERN", "solved"],
  ["Tidal Logic", ["logic"], "ANCHOR", "solved"],
  ["Gull Talk", ["wordplay"], null, "extraction"],
  ["Shipping Forecast", ["cipher"], null, "stuck"],
  ["Rope Tricks", ["physical"], null, "active"],
];
const feederIds = {};
for (const [name, tags, answer, status] of lighthouseFeeders) {
  const p = await puzzle(
    {name, tags, link: "https://example.com/hunt/puzzles"},
    {parentPuzzleId: keepersLog.id}
  );
  feederIds[name] = p.id;
  if (answer) await update(p.id, {answer, status});
  else await update(p.id, {status});
}
await update(feederIds["Shipping Forecast"], {importance: "important"});

// Round 2: Tide Pools.
const tidePools = await round("Tide Pools");
const lowTide = await meta("Low Tide", tidePools.id);
for (const [name, tags, answer, status] of [
  ["Barnacle Bingo", ["logic"], "LIMPET", "solved"],
  ["Starfish Sudoku", ["logic"], null, "needs_eyes"],
  ["Kelp Me", ["wordplay"], null, null],
]) {
  const p = await puzzle({name, tags}, {parentPuzzleId: lowTide.id});
  feederIds[name] = p.id;
  if (answer) await update(p.id, {answer, status});
  else if (status) await update(p.id, {status});
}
// A two-answer puzzle.
const twins = await puzzle(
  {name: "Double Rainbow", tags: ["wordplay"]},
  {parentPuzzleId: lowTide.id}
);
feederIds["Double Rainbow"] = twins.id;
await update(twins.id, {answerCount: 2, answer: "INDIGO", status: "active"});

// Round 3: unassigned puzzles (no meta yet).
const deepWater = await round("Deep Water");
for (const [name, tags] of [
  ["Sonar Ping", ["music"]],
  ["Pressure Points", ["logic"]],
]) {
  const p = await puzzle({name, tags}, {roundId: deepWater.id});
  feederIds[name] = p.id;
}

// Guesses on the puzzles still in play.
const guess = (puzzleId, answer) => rpc("guesses/add", {workspaceSlug: SLUG, puzzleId, answer});
await guess(feederIds["Gull Talk"], "SEAGULL");
await guess(feederIds["Gull Talk"], "WINGSPAN");
await guess(feederIds["Shipping Forecast"], "GALE WARNING");
const guesses = (
  await db.execute("select id, answer from puzzle_guess where workspaceId = ? order by createdAt", [
    workspaceId,
  ])
).rows;
const setGuess = (answer, fields) =>
  rpc("guesses/update", {
    workspaceSlug: SLUG,
    id: guesses.find(g => g.answer === answer).id,
    ...fields,
  });
await setGuess("SEAGULL", {status: "incorrect"});
await setGuess("WINGSPAN", {status: "submitted"});
await setGuess("GALE WARNING", {status: "queued", retryAt: now + 4 * 60_000});
// Teammates queued them (as the queue shows who).
await db.execute(
  "update puzzle_guess set createdBy = ? where workspaceId = ? and answer in ('SEAGULL', 'WINGSPAN')",
  ["dev-user-1", workspaceId]
);
await db.execute(
  "update puzzle_guess set createdBy = ? where workspaceId = ? and answer = 'GALE WARNING'",
  ["dev-user-4", workspaceId]
);

// Who helped solve what, and time on puzzles (for the leaderboard and stats).
const helped = {
  "Foghorn Fugue": ["dev-user-1", "dev-user-3"],
  "Beacon Crossing": ["dev-user-2", "dev-user-1", "dev-user-5"],
  "Tidal Logic": ["dev-user-4", "dev-user-1"],
  "Barnacle Bingo": ["dev-user-3", "dev-user-8"],
};
for (const [name, users] of Object.entries(helped)) {
  for (const userId of users) {
    await db.execute(
      "insert into puzzle_contributor (puzzleId, userId, createdAt) values (?, ?, ?)",
      [feederIds[name], userId, now - 5 * HOUR]
    );
  }
}
const nowHour = Math.floor(now / HOUR);
const time = [
  ["dev-user-1", "Foghorn Fugue", 14, 2400],
  ["dev-user-1", "Beacon Crossing", 2, 3000],
  ["dev-user-2", "Beacon Crossing", 3, 2700],
  ["dev-user-3", "Foghorn Fugue", 7, 1800],
  ["dev-user-3", "Barnacle Bingo", 8, 2100],
  ["dev-user-4", "Tidal Logic", 1, 3300],
  ["dev-user-4", "Shipping Forecast", 23, 2200],
  ["dev-user-5", "Gull Talk", 9, 1500],
  ["dev-user-8", "Barnacle Bingo", 16, 1900],
  ["dev-user-8", "Starfish Sudoku", 17, 1200],
];
for (const [i, [userId, name, localHour, seconds]] of time.entries()) {
  await db.execute(
    "insert into puzzle_time (userId, puzzleId, workspaceId, hour, localHour, seconds, updatedAt) values (?, ?, ?, ?, ?, ?, ?)",
    [userId, feederIds[name], workspaceId, nowHour - 18 + i, localHour, seconds, now]
  );
}

// The test account's name shows in the screenshots: something readable (local DB only).
await db.execute("update user set name = 'Alex Rivera' where email = ?", [account.email]);

// A little conversation (as the test account; the chat rooms keep it).
async function chat(path, messages) {
  const socket = new WebSocket(`${BASE.replace("http", "ws")}${path}`, {headers: {cookie}});
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, {once: true});
    socket.addEventListener("error", reject, {once: true});
  });
  for (const text of messages) {
    socket.send(JSON.stringify({type: "send", text}));
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  await new Promise(resolve => setTimeout(resolve, 800));
  socket.close();
}
await chat(`/api/workspaces/${SLUG}/chat`, [
  "Lighthouse meta: 3 of 6 feeders in. If you're free, grab **Rope Tricks** or **Gull Talk**.",
  "Lunch in 20 minutes 🧇 the lobby call stays open.",
]);
await chat(`/api/chat/${feederIds["Gull Talk"]}`, [
  "Every clue's answer is a seabird. I'm listing them in the sheet, column B.",
  "The numbers in the margin look like indexes: try `=NTH(B2:B7, C2:C7)`.",
  "!stuck",
]);

// The rows above went straight to the database: have the workspace's live state re-read them.
await rpc("workspaces/update", {
  workspaceSlug: SLUG,
  tags: ["crossword", "wordplay", "logic", "music", "cipher", "physical"],
});

console.log(`Seeded ${BASE}/${SLUG}`);
process.exit(0);
