import {z} from "zod";

import {BEARER_PROTOCOL} from "@/lib/extension";
import {
  type MentionNotification,
  NOTIFICATION_PING,
  NOTIFICATION_PONG,
  type NotificationClientMessage,
  type NotificationMessage,
  type ReadState,
} from "@/server/notifications";

import {getAccessToken} from "./auth";
import type {TabMessage} from "./messages";
import {getDefaultWorkspace, getMentionNotifications, wowChatUrl} from "./settings";

/**
 * Desktop notifications when someone @mentions you in your default workspace, from the background
 * (service worker), so they arrive whatever tab you're on.
 *
 * The background keeps the workspace's notifications socket open (the one the website's bell
 * uses; the room sends a socket only its own mentions). A ping every 20 seconds keeps the socket,
 * and with it the service worker, alive; an alarm every minute reconnects if Chrome stopped the
 * worker anyway, or if the socket has gone quiet (stuck connecting, or dead after the computer
 * slept or changed networks, which a socket doesn't always notice). Mentions that arrived meanwhile come with the history the room sends on
 * connecting, so they're shown then, unless you've read them in WOW since.
 *
 * Each mention is shown once (handled ids are kept), and not at all while you're already looking
 * at its chat: WOW's own tab for the workspace, or that puzzle's sidebar.
 */

const ORIGIN = import.meta.env.WOW_ORIGIN;
const PING_MS = 20_000;
/** A socket that hasn't heard anything (not even a pong) for this long is replaced. */
const QUIET_MS = 3 * PING_MS;
const ALARM = "mention-notifications";
/** Mentions already shown (or there before you were notified of any), by workspace and person. */
const HANDLED = "mentionsHandled";
const KEEP_HANDLED = 200;
/** At most this many missed mentions pop up on reconnecting (the newest); the rest are in WOW. */
const MISSED_SHOWN = 3;
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 5 * 60_000;

const handledSchema = z.object({key: z.string(), ids: z.string().array()});

type Connection = {
  key: string;
  workspaceSlug: string;
  socket: WebSocket;
  /** When it last heard from the room (or started connecting). */
  heardAt: number;
  ping?: ReturnType<typeof setInterval>;
  /** The history, held until the read state (sent right after it) says which are unread. */
  history?: MentionNotification[];
};

let connection: Connection | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;
let retryMs = RETRY_MIN_MS;
let syncing: Promise<void> = Promise.resolve();

/** Starts notifying (at the background's startup), and keeps in step with what it depends on. */
export function startMentionNotifications() {
  void browser.alarms.create(ALARM, {periodInMinutes: 1});
  browser.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM) syncMentionNotifications();
  });
  // Signing in or out, another workspace, or the switch in the popup.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "auth" in changes) syncMentionNotifications();
    if (area === "sync" && ("defaultWorkspace" in changes || "mentionNotifications" in changes)) {
      syncMentionNotifications();
    }
  });
  browser.notifications.onClicked.addListener(id => void openMention(id));
  syncMentionNotifications();
}

/** Connects, reconnects or disconnects, for who's signed in, the workspace and the switch. */
export function syncMentionNotifications() {
  syncing = syncing.then(sync, sync);
}

async function sync() {
  const [workspaceSlug, enabled, signedIn] = await Promise.all([
    getDefaultWorkspace(),
    getMentionNotifications(),
    getAccessToken().catch(() => null),
  ]);
  const key = signedIn && workspaceSlug && enabled ? `${workspaceSlug}:${signedIn.user.id}` : null;
  if (connection && connection.key === key && Date.now() - connection.heardAt < QUIET_MS) return;
  disconnect();
  if (!key || !workspaceSlug || !signedIn) return;
  connect(key, workspaceSlug, signedIn.token);
}

function disconnect() {
  clearTimeout(retry);
  retry = undefined;
  if (!connection) return;
  const {socket, ping} = connection;
  connection = undefined;
  clearInterval(ping);
  socket.close();
}

function connect(key: string, workspaceSlug: string, token: string) {
  const url = `${ORIGIN.replace(/^http/, "ws")}/api/notification/${encodeURIComponent(workspaceSlug)}`;
  const socket = new WebSocket(url, [BEARER_PROTOCOL, token]);
  const current: Connection = {key, workspaceSlug, socket, heardAt: Date.now()};
  connection = current;
  socket.addEventListener("open", () => {
    current.heardAt = Date.now();
    retryMs = RETRY_MIN_MS;
    current.ping = setInterval(() => socket.send(NOTIFICATION_PING), PING_MS);
  });
  socket.addEventListener("message", event => {
    current.heardAt = Date.now();
    if (typeof event.data === "string") void receive(current, event.data);
  });
  socket.addEventListener("close", () => {
    clearInterval(current.ping);
    if (connection !== current) return; // Closed on purpose.
    connection = undefined;
    // Dropped (a deploy, the network, an expired sign-in): try again, waiting longer each time.
    retry = setTimeout(syncMentionNotifications, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  });
}

async function receive(current: Connection, data: string) {
  if (data === NOTIFICATION_PONG) return;
  let message: NotificationMessage;
  try {
    message = JSON.parse(data);
  } catch {
    return;
  }
  if (message.type === "history") {
    current.history = message.notifications.filter(isMention);
  } else if (message.type === "readState") {
    const history = current.history;
    current.history = undefined;
    if (history) await missed(current, history, message);
  } else if (isMention(message)) {
    await handle(current.key, [message.id], () => show(current.workspaceSlug, [message]));
  }
}

const isMention = (notification: {type: string}): notification is MentionNotification =>
  notification.type === "mention";

/**
 * On connecting: the unread mentions in the history not shown yet. The first time (for this
 * workspace and person), none: those are from before you had the extension notify you.
 */
async function missed(current: Connection, history: MentionNotification[], read: ReadState) {
  const ids = history.map(mention => mention.id);
  await handle(current.key, ids, async handled => {
    if (!handled) return;
    const unread = history.filter(
      mention =>
        !handled.has(mention.id) &&
        mention.timestamp > read.seenAt &&
        !read.readIds.includes(mention.id)
    );
    // History is newest first.
    await show(current.workspaceSlug, unread.slice(0, MISSED_SHOWN));
  });
}

let handling: Promise<unknown> = Promise.resolve();

/**
 * Runs `act` with the ids already handled for `key` (null if none ever were), then records `ids` as
 * handled. One at a time, so a mention arriving live as the history is read is shown once.
 */
function handle(
  key: string,
  ids: string[],
  act: (handled: Set<string> | null) => Promise<void>
): Promise<void> {
  const next = handling.then(async () => {
    const stored = handledSchema.safeParse((await browser.storage.local.get(HANDLED))[HANDLED]);
    const handled = stored.success && stored.data.key === key ? new Set(stored.data.ids) : null;
    const fresh = ids.filter(id => !handled?.has(id));
    if (handled && fresh.length === 0) return undefined;
    await act(handled);
    const all = [...(handled ?? []), ...fresh].slice(-KEEP_HANDLED);
    await browser.storage.local.set({[HANDLED]: {key, ids: all}});
    return undefined;
  });
  handling = next.catch(() => undefined);
  return next;
}

async function show(workspaceSlug: string, mentions: MentionNotification[]) {
  await Promise.all(
    mentions.map(async mention => {
      if (await lookingAt(workspaceSlug, mention.puzzleId)) return;
      await browser.notifications.create(notificationId(workspaceSlug, mention), {
        type: "basic",
        iconUrl: browser.runtime.getURL("/icon/128.png"),
        title: `${mention.from.name} mentioned you in ${mention.puzzleName}`,
        message: mention.text,
        eventTime: mention.timestamp,
      });
    })
  );
}

/**
 * Whether you're already looking at the mention's chat, in the window you're using: WOW's own tab
 * for the workspace (which shows it in the bell, and pops it up), or the puzzle's sidebar.
 */
async function lookingAt(workspaceSlug: string, puzzleId: string | null) {
  const window = await browser.windows.getLastFocused({populate: true}).catch(() => undefined);
  if (!window?.focused || window.state === "minimized") return false;
  const tab = window.tabs?.find(t => t.active);
  if (tab?.id === undefined) return false;
  // Chrome tells the extension the URL of WOW's tabs (it has access to WOW's site).
  if (tab.url?.startsWith(`${ORIGIN}/${workspaceSlug}`)) return true;
  if (puzzleId === null) return false;
  const answer: unknown = await browser.tabs
    .sendMessage(tab.id, {type: "sidebarShown"} satisfies TabMessage)
    .catch(() => null);
  return (
    z.object({puzzleId: z.string()}).nullable().catch(null).parse(answer)?.puzzleId === puzzleId
  );
}

/** Where a click goes, in the notification's id: "mention|<workspace>|<puzzle or empty>|<id>". */
const notificationId = (workspaceSlug: string, mention: MentionNotification) =>
  ["mention", workspaceSlug, mention.puzzleId ?? "", mention.id].join("|");

/** Opens the chat the mention is in, in WOW, and marks it read there. */
async function openMention(id: string) {
  const [kind, workspaceSlug, puzzleId, mentionId] = id.split("|");
  if (kind !== "mention" || !workspaceSlug || mentionId === undefined) return;
  await browser.notifications.clear(id);
  await browser.tabs.create({url: wowChatUrl(workspaceSlug, puzzleId || null)});
  const socket = connection?.workspaceSlug === workspaceSlug ? connection.socket : undefined;
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({type: "read", ids: [mentionId]} satisfies NotificationClientMessage)
    );
  }
}
