/**
 * What the extension remembers for you (synced across your Chrome profiles): the workspace it
 * works in, the round you last added a puzzle to in each workspace, and whether it notifies you of
 * @mentions.
 */
const DEFAULT_WORKSPACE = "defaultWorkspace";
export const MENTION_NOTIFICATIONS = "mentionNotifications";
const lastRoundKey = (workspaceSlug: string) => `lastRound:${workspaceSlug}`;

export async function getDefaultWorkspace(): Promise<string | null> {
  const value = (await browser.storage.sync.get(DEFAULT_WORKSPACE))[DEFAULT_WORKSPACE];
  return typeof value === "string" ? value : null;
}

export async function setDefaultWorkspace(workspaceSlug: string | null) {
  if (workspaceSlug) await browser.storage.sync.set({[DEFAULT_WORKSPACE]: workspaceSlug});
  else await browser.storage.sync.remove(DEFAULT_WORKSPACE);
}

export async function getLastRound(workspaceSlug: string): Promise<string | null> {
  const key = lastRoundKey(workspaceSlug);
  const value = (await browser.storage.sync.get(key))[key];
  return typeof value === "string" ? value : null;
}

export async function setLastRound(workspaceSlug: string, roundId: string) {
  await browser.storage.sync.set({[lastRoundKey(workspaceSlug)]: roundId});
}

/** Whether to show a desktop notification when someone @mentions you (on unless turned off). */
export async function getMentionNotifications(): Promise<boolean> {
  return (await browser.storage.sync.get(MENTION_NOTIFICATIONS))[MENTION_NOTIFICATIONS] !== false;
}

export async function setMentionNotifications(on: boolean) {
  await browser.storage.sync.set({[MENTION_NOTIFICATIONS]: on});
}

/** Calls `onChange` when the default workspace changes (here or in another window). */
export function watchDefaultWorkspace(onChange: (workspaceSlug: string | null) => void) {
  const listener = (changes: Record<string, {newValue?: unknown}>, area: string) => {
    if (area !== "sync" || !(DEFAULT_WORKSPACE in changes)) return;
    const value = changes[DEFAULT_WORKSPACE]?.newValue;
    onChange(typeof value === "string" ? value : null);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** WOW's page for a puzzle. */
export const wowPuzzleUrl = (workspaceSlug: string, puzzleId: string) =>
  `${import.meta.env.WOW_ORIGIN}/${workspaceSlug}/puzzles/${puzzleId}`;

/** WOW's page for a chat: a puzzle's page open at its chat, or the blackboard for the team chat. */
export const wowChatUrl = (workspaceSlug: string, puzzleId: string | null) =>
  puzzleId
    ? `${wowPuzzleUrl(workspaceSlug, puzzleId)}?view=chat`
    : `${import.meta.env.WOW_ORIGIN}/${workspaceSlug}`;
