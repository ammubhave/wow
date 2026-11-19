// Takes the docs' screenshots (src/docs/images/*.webp) of the demo workspace, with headless Chrome
// over the DevTools protocol: 2× resolution, dark theme, the same every time.
//
// LOCAL DEV ONLY. First: the dev server on :3124 and `node scripts/seed-docs-demo.mjs`.
// Usage: node scripts/docs-screenshots.mjs [name…]   (no names: all of them)
import {spawn} from "node:child_process";
import {mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";

import {createClient} from "@libsql/client";

const BASE = "http://localhost:3124";
const SLUG = "red-herrings";
const OUT = "src/docs/images";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DB =
  "file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/722596595d721d84ff41d8d4d2f284f98b54fb861431dc96221983537ebe2989.sqlite";

// Puzzle ids by name, in the demo workspace.
const db = createClient({url: DB});
const puzzles = Object.fromEntries(
  (
    await db.execute(
      "select p.name, p.id from puzzle p join round r on r.id = p.roundId join organization o on o.id = r.workspaceId where o.slug = ?",
      [SLUG]
    )
  ).rows.map(row => [row.name, row.id])
);
const huntId = (
  await db.execute("select id from hunt_listings where name like 'MIT Mystery Hunt%' limit 1")
).rows[0]?.id;

// Signed in as the dev test account.
const account = JSON.parse(readFileSync(".wrangler/dev-test-account.json", "utf8"));
const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: {"content-type": "application/json", origin: BASE},
  body: JSON.stringify({email: account.email, password: account.password}),
});
const cookies = signIn.headers.getSetCookie().map(c => {
  const [pair] = c.split(";");
  const index = pair.indexOf("=");
  return {name: pair.slice(0, index), value: pair.slice(index + 1)};
});

const puzzleUrl = (name, view = "") =>
  `${BASE}/${SLUG}/puzzles/${puzzles[name]}${view ? `?view=${view}` : ""}`;
const DESKTOP = {width: 1280, height: 800, scale: 2};
const PHONE = {width: 390, height: 844, scale: 3, mobile: true};

/** Clicks the first button (or link) whose text or label matches. */
const click = text => `(() => {
  const el = [...document.querySelectorAll("button, a, [role=button]")].find(e =>
    (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().startsWith(${JSON.stringify(text)}));
  el?.click();
  return Boolean(el);
})()`;

// What to shoot: a page, things to do first, and an optional element to crop to (CSS selector,
// with padding).
const SHOTS = [
  {name: "board", url: `${BASE}/${SLUG}`, wait: 4000},
  {
    name: "puzzle-page",
    url: puzzleUrl("Gull Talk"),
    wait: 8000,
    // A worked example in the sheet (dev builds expose the sheet as window.__sheet).
    actions: [
      `(() => {
        const sheet = window.__sheet?.api.getActiveWorkbook()?.getActiveSheet();
        if (!sheet) return false;
        const rows = [
          ["Clue", "Seabird", "Index", "Letter"],
          ["Storm-loving seabird", "PETREL", 3, "=NTH(B2, C2)"],
          ["Duck famed for its down", "EIDER", 1, "=NTH(B3, C3)"],
          ["Sea crow", "CORMORANT", 3, "=NTH(B4, C4)"],
          ["Plunge-diving seabird", "GANNET", 3, "=NTH(B5, C5)"],
          ["", "", "Answer", "=D2&D3&D4&D5"],
        ];
        rows.forEach((row, r) => row.forEach((value, c) => sheet.getRange(r, c).setValue(value)));
        sheet.getRange("F1").setValue("Pattern ?ERN");
        sheet.getRange("F2").setValue('=MATCHES("?ERN", 6)');
        sheet.setColumnWidths(0, 1, 190);
        sheet.getRange("D7").activate();
        return true;
      })()`,
    ],
  },
  {
    name: "puzzle-tools",
    url: puzzleUrl("Gull Talk"),
    wait: 7000,
    actions: [click("Puzzle tools")],
    clip: "[role=dialog]",
  },
  {name: "guesses", url: puzzleUrl("Gull Talk"), wait: 6000, clip: "section[aria-label=Guesses]"},
  {
    name: "guess-queue",
    url: `${BASE}/${SLUG}`,
    wait: 4000,
    actions: [click("Guess queue")],
    clip: "[role=dialog]",
  },
  {name: "info-panel", url: puzzleUrl("Shipping Forecast"), wait: 6000, clip: "form"},
  {
    name: "feeder-answers",
    url: puzzleUrl("Keeper's Log"),
    wait: 6000,
    clip: "section[aria-label='Feeder answers']",
  },
  {name: "leaderboard", url: `${BASE}/${SLUG}/recap`, wait: 4000},
  {name: "activity-log", url: `${BASE}/${SLUG}/activity-log`, wait: 4000},
  {name: "settings", url: `${BASE}/${SLUG}/settings`, wait: 3000},
  {
    name: "notifications",
    url: `${BASE}/${SLUG}`,
    wait: 4000,
    actions: [click("Notifications")],
    clip: "[role=dialog]",
  },
  {
    name: "command-palette",
    url: `${BASE}/${SLUG}`,
    wait: 4000,
    keys: [{key: "k", modifiers: 4}],
    clip: "[role=dialog]",
  },
  {name: "workspaces", url: `${BASE}/workspaces`, wait: 4000},
  {
    name: "create-workspace",
    url: huntId
      ? `${BASE}/workspaces/create?hunt=${huntId}&event=${encodeURIComponent("MIT Mystery Hunt 2027")}`
      : `${BASE}/workspaces/create`,
    wait: 3000,
  },
  {name: "hunts-list", url: `${BASE}/hunts`, wait: 3000},
  {name: "hunts-calendar", url: `${BASE}/hunts?view=calendar`, wait: 3000},
  {name: "phone-board", url: `${BASE}/${SLUG}`, wait: 4000, device: PHONE},
  {name: "phone-puzzle", url: puzzleUrl("Gull Talk", "info"), wait: 5000, device: PHONE},
];

// Chrome, headless, on a throwaway profile.
const port = 9333;
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "wow-shots-"))}`,
    "--hide-scrollbars",
    "--no-first-run",
    "--force-color-profile=srgb",
  ],
  {stdio: "ignore"}
);
let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: "PUT"})
    .then(r => r.json())
    .catch(() => undefined);
}
if (!target) throw new Error("Chrome didn't start");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, {once: true}));
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, message =>
      message.error
        ? reject(new Error(`${method}: ${message.error.message}`))
        : resolve(message.result)
    );
    socket.send(JSON.stringify({id, method, params}));
  });
const evaluate = async expression =>
  (await send("Runtime.evaluate", {expression, awaitPromise: true, returnByValue: true})).result
    ?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");
await send("Network.setCookies", {cookies: cookies.map(c => ({...c, url: BASE}))});
await send("Emulation.setEmulatedMedia", {
  features: [
    {name: "prefers-color-scheme", value: "dark"},
    {name: "prefers-reduced-motion", value: "reduce"},
  ],
});

const only = new Set(process.argv.slice(2));
for (const shot of SHOTS.filter(s => only.size === 0 || only.has(s.name))) {
  const device = shot.device ?? DESKTOP;
  await send("Emulation.setDeviceMetricsOverride", {
    width: device.width,
    height: device.height,
    deviceScaleFactor: device.scale,
    mobile: Boolean(device.mobile),
  });
  await send("Emulation.setTouchEmulationEnabled", {enabled: Boolean(device.mobile)});
  await send("Page.navigate", {url: shot.url});
  await sleep(shot.wait);
  for (const action of shot.actions ?? []) {
    await evaluate(action);
    await sleep(1200);
  }
  for (const {key, modifiers} of shot.keys ?? []) {
    for (const type of ["keyDown", "keyUp"]) {
      await send("Input.dispatchKeyEvent", {type, key, code: `Key${key.toUpperCase()}`, modifiers});
    }
    await sleep(1200);
  }
  // Dev-only overlays (TanStack devtools' button) aren't part of the app.
  await evaluate(
    `document.querySelectorAll('[aria-label="Open TanStack Devtools"], .tsqd-open-btn-container').forEach(e => e.closest("div[style*=fixed], button")?.style.setProperty("display", "none"))`
  );
  await evaluate(
    `(() => { const s = document.createElement("style"); s.textContent = '[aria-label="Open TanStack Devtools"]{display:none!important}'; document.head.append(s); })()`
  );
  let clip;
  if (shot.clip) {
    await evaluate(
      `document.querySelector(${JSON.stringify(shot.clip)})?.scrollIntoView({block: "center"})`
    );
    await sleep(400);
    const rect = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(shot.clip)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {x: r.x, y: r.y, width: r.width, height: r.height};
    })()`);
    if (rect) {
      const pad = 16;
      const x = Math.max(0, rect.x - pad);
      const y = Math.max(0, rect.y - pad);
      clip = {
        x,
        y,
        width: Math.min(device.width - x, rect.width + 2 * pad),
        height: Math.min(device.height - y, rect.height + 2 * pad),
        scale: 1,
      };
    } else console.warn(`  ${shot.name}: "${shot.clip}" not found; taking the whole page`);
  }
  const {data} = await send("Page.captureScreenshot", {format: "webp", quality: 82, clip});
  writeFileSync(join(OUT, `${shot.name}.webp`), Buffer.from(data, "base64"));
  console.log(`✓ ${shot.name}`);
}

socket.close();
chrome.kill();
process.exit(0);
