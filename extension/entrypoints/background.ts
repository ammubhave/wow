import {z} from "zod";

import {setApiEndpoint} from "@/lib/api-endpoint";
import {client} from "@/lib/orpc";
import {findPuzzleForUrl} from "@/lib/puzzle-url";

import {getAccessToken, signIn, signOut, syncImageAuth} from "../lib/auth";
import {startMentionNotifications} from "../lib/mention-notifications";
import type {PuzzleMatch, Request, TabMessage} from "../lib/messages";
import {pageInfoSchema} from "../lib/page-info";
import {getDefaultWorkspace, getLastRound} from "../lib/settings";

/**
 * The extension's background: signs in and keeps the tokens (lib/auth.ts), tells the content
 * script whether its page is a puzzle in your default workspace (and marks the toolbar icon when it
 * is), adds the page as a puzzle from its context menu, and notifies you of @mentions
 * (lib/mention-notifications.ts).
 */
export default defineBackground(() => {
  let token: string | undefined;
  setApiEndpoint({origin: import.meta.env.WOW_ORIGIN, accessToken: () => token});

  /** Calls the API signed in, or returns null when nobody is. */
  async function signedIn<T>(call: () => Promise<T>): Promise<T | null> {
    const current = await getAccessToken();
    if (!current) return null;
    token = current.token;
    return call();
  }

  /** Whether this browser's push subscription brings @mentions, as WOW last said (cached). */
  let pushStatus: {at: number; brings: Promise<boolean>} | undefined;

  // The puzzles of a workspace, briefly: a page asks on every navigation.
  const PUZZLES_MS = 30_000;
  const puzzles = new Map<string, {at: number; list: Promise<PuzzleLink[] | null>}>();
  type PuzzleLink = {id: string; name: string; link: string | null};

  function puzzlesOf(workspaceSlug: string) {
    const cached = puzzles.get(workspaceSlug);
    if (cached && Date.now() - cached.at < PUZZLES_MS) return cached.list;
    const list = signedIn(async () => {
      const state = await client.workspaces.state({workspaceSlug});
      return state.rounds.flatMap(round =>
        round.puzzles.map(puzzle => ({id: puzzle.id, name: puzzle.name, link: puzzle.link}))
      );
    }).catch(() => null);
    puzzles.set(workspaceSlug, {at: Date.now(), list});
    return list;
  }

  async function matchUrl(url: string): Promise<PuzzleMatch | null> {
    if (url.startsWith(import.meta.env.WOW_ORIGIN)) return null;
    const workspaceSlug = await getDefaultWorkspace();
    if (!workspaceSlug) return null;
    const puzzle = findPuzzleForUrl(url, (await puzzlesOf(workspaceSlug)) ?? []);
    return puzzle ? {workspaceSlug, puzzleId: puzzle.id, name: puzzle.name} : null;
  }

  async function handle(request: Request, tabId: number | undefined) {
    switch (request.type) {
      case "getAccessToken":
        return getAccessToken();
      case "signIn":
        try {
          puzzles.clear();
          pushStatus = undefined;
          return {user: await signIn()};
        } catch (error) {
          return {error: error instanceof Error ? error.message : "Couldn't sign in."};
        }
      case "signOut":
        puzzles.clear();
        pushStatus = undefined;
        await signOut();
        return null;
      case "matchUrl": {
        const match = await matchUrl(request.url);
        if (tabId !== undefined) await markTab(tabId, match);
        return match;
      }
      case "puzzlesChanged":
        puzzles.clear();
        return null;
      default:
        return null;
    }
  }

  browser.runtime.onMessage.addListener((request: Request, sender) =>
    handle(request, sender.tab?.id)
  );

  // Adds the page as a puzzle in one click, from the page's context menu: in your default
  // workspace, in the round you last added one to. Without those yet, the popup asks.
  const ADD_MENU = "wow-add-puzzle";
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: ADD_MENU,
      title: "Add this puzzle to WOW",
      contexts: ["page", "frame", "link"],
    });
  });
  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== ADD_MENU || tab?.id === undefined) return;
    const url = info.linkUrl ?? tab.url;
    const workspaceSlug = await getDefaultWorkspace();
    const roundId = workspaceSlug && (await getLastRound(workspaceSlug));
    if (!url || !workspaceSlug || !roundId || info.linkUrl) {
      // Name, round and the link itself are the popup's to confirm.
      await openPopup(tab.id);
      return;
    }
    if (await matchUrl(url)) {
      await tell(tab.id, {type: "expand"});
      return;
    }
    const name = await pageTitle(tab.id, tab.title);
    const added = await signedIn(() =>
      client.puzzles.create({type: "puzzle", workspaceSlug, roundId, name, tags: [], link: url})
    ).catch(() => null);
    if (!added) {
      await openPopup(tab.id);
      return;
    }
    puzzles.clear();
    await tell(tab.id, {type: "recheck"});
  });

  // WOW's site tells the extension which push subscription this browser has (src/lib/extension.ts):
  // when it brings your @mentions, the extension doesn't show them too.
  browser.runtime.onMessageExternal.addListener((message: unknown, sender) => {
    if (sender.origin !== import.meta.env.WOW_ORIGIN) return undefined;
    const parsed = webPushMessageSchema.safeParse(message);
    if (!parsed.success) return undefined;
    pushStatus = undefined;
    const {endpoint} = parsed.data;
    void (endpoint
      ? browser.storage.local.set({[WEB_PUSH]: endpoint})
      : browser.storage.local.remove(WEB_PUSH));
    return undefined;
  });

  // Asked about once every few minutes at most: push can be turned off on another device, or
  // stop when the browser withdraws it, so the server's word is the one that counts.
  const PUSH_STATUS_MS = 5 * 60_000;
  function pushBringsMentions() {
    if (pushStatus && Date.now() - pushStatus.at < PUSH_STATUS_MS) return pushStatus.brings;
    const brings = (async () => {
      const endpoint: unknown = (await browser.storage.local.get(WEB_PUSH))[WEB_PUSH];
      if (typeof endpoint !== "string") return false;
      const status = await signedIn(() => client.push.status({endpoint}));
      return status?.kinds.includes("mention") ?? false;
    })().catch(() => {
      // Not sure: notify (twice, at worst) rather than miss the mention.
      pushStatus = undefined;
      return false;
    });
    pushStatus = {at: Date.now(), brings};
    return brings;
  }

  browser.runtime.onStartup.addListener(() => void syncImageAuth());
  void syncImageAuth();
  startMentionNotifications({pushBringsMentions});
});

/** Storage key for this browser's push subscription endpoint, as WOW's site last said. */
const WEB_PUSH = "webPushEndpoint";
const webPushMessageSchema = z.object({
  type: z.literal("webPush"),
  endpoint: z.string().max(2048).nullable(),
});

// A mark on the toolbar icon on a page that's one of your puzzles.
async function markTab(tabId: number, match: PuzzleMatch | null) {
  await browser.action.setBadgeText({tabId, text: match ? "✓" : ""}).catch(() => undefined);
  if (match) {
    await browser.action.setBadgeBackgroundColor({tabId, color: "#e07b1f"}).catch(() => undefined);
  }
  await browser.action
    .setTitle({tabId, title: match ? `WOW: ${match.name}` : "WOW"})
    .catch(() => undefined);
}

const tell = (tabId: number, message: TabMessage) =>
  browser.tabs.sendMessage(tabId, message).catch(() => undefined);

/** The popup, for `tabId`; as a small window where Chrome won't open the popup itself. */
async function openPopup(tabId: number) {
  try {
    await browser.action.openPopup();
  } catch {
    await browser.windows.create({
      url: browser.runtime.getURL(`/popup.html?tabId=${tabId}`),
      type: "popup",
      width: 400,
      height: 560,
    });
  }
}

/** The page's puzzle name, as its content script reads it (else the tab's title). */
async function pageTitle(tabId: number, fallback = "Untitled puzzle") {
  const answer: unknown = await browser.tabs
    .sendMessage(tabId, {type: "pageInfo"} satisfies TabMessage)
    .catch(() => undefined);
  return pageInfoSchema.catch({}).parse(answer).title?.trim() || fallback;
}
