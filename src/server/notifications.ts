import {z} from "zod";

/**
 * Workspace notifications: what the bell lists, and what pops up as a toast or desktop notification.
 * Kept (the most recent ones) by the workspace's NotificationRoom, which also pushes them live.
 */
type NotificationBase = {id: string; timestamp: number};

export type SolvedNotification = NotificationBase & {
  type: "solved";
  /** "Puzzle X was solved!" (older clients only read this). */
  message: string;
  puzzleId: string;
  puzzleName: string;
  answer: string | null;
  isMeta: boolean;
  by: {id: string; name: string} | null;
};

export type AnnouncementNotification = NotificationBase & {
  type: "announcement";
  message: string;
  from: string;
};

export type MentionNotification = NotificationBase & {
  type: "mention";
  /** Who was mentioned (the bell shows a mention only to them). */
  toUserIds: string[];
  from: {id: string; name: string};
  /** Where: a puzzle's chat, or null for the team chat (then `puzzleName` is "Team chat"). */
  puzzleId: string | null;
  puzzleName: string;
  /** The message, as plain text (mentions as "@Name"). */
  text: string;
};

/**
 * Something happened on a puzzle you starred (only the people who starred it get it, not whoever
 * did it). Solves aren't sent this way: everyone hears about those.
 */
export type FavoriteNotification = NotificationBase & {
  type: "favorite";
  toUserIds: string[];
  puzzleId: string;
  puzzleName: string;
  by: {id: string; name: string};
  change:
    | {kind: "status"; status: string | null}
    | {kind: "guessQueued"; answer: string}
    | {kind: "guessResult"; answer: string; result: "incorrect" | "partial"};
};

/** An email arrived at the workspace's contact address (it's in the workspace's Inbox). */
export type EmailNotification = NotificationBase & {
  type: "email";
  emailId: string;
  /** The sender's name, or their address when the email gives no name. */
  from: string;
  subject: string | null;
  /** The start of the body, as plain text on one line. */
  preview: string;
};

/**
 * WOW couldn't share the workspace's Google Drive folder with someone who joined (usually a file
 * in it wasn't created through WOW, which the app's Drive access can't touch), or couldn't take
 * away the access of someone who left or was removed. Only the owners see it: they're the ones who
 * can change the folder's sharing by hand.
 */
export type DriveShareFailedNotification = NotificationBase & {
  type: "driveShareFailed";
  /** Sharing with a new member (the default, as older notifications were) or removing a former one. */
  access?: "share" | "unshare";
  toUserIds: string[];
  member: {id: string; name: string; email: string};
  folderId: string;
  /** Why, in plain words. */
  detail: string;
  /** The file (added outside WOW) that stops the folder being shared, when Google names it. */
  blockingFileId?: string;
};

export type WorkspaceNotification =
  | SolvedNotification
  | AnnouncementNotification
  | MentionNotification
  | EmailNotification
  | DriveShareFailedNotification
  | FavoriteNotification;

/**
 * What you've read (per person, kept by the room, so it follows you across browsers): everything
 * up to `seenAt` ("Mark all as read"), plus ones opened individually since.
 */
export type ReadState = {seenAt: number; readIds: string[]};

/**
 * What the server sends: a new notification; the recent history when a socket connects; your read
 * state (on connect, and whenever it changes on any of your devices).
 */
export type NotificationMessage =
  | WorkspaceNotification
  | {type: "history"; notifications: WorkspaceNotification[]}
  | ({type: "readState"} & ReadState);

/** What a client sends: mark some notifications read, or all of them. */
export const notificationClientMessageSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("read"), ids: z.string().max(64).array().min(1).max(50)}),
  z.object({type: z.literal("readAll")}),
]);
export type NotificationClientMessage = z.infer<typeof notificationClientMessageSchema>;

/** A notification as passed in, before the room stamps it. */
export type NewNotification = WorkspaceNotification extends infer N
  ? N extends WorkspaceNotification
    ? Omit<N, "id" | "timestamp">
    : never
  : never;

// Mentions are stored in chat messages as markdown links, so they render (and copy) sensibly
// anywhere: [@Priya Raman](#mention-<userId>).
export const MENTION_PATTERN = /\[@([^\]]+)\]\(#mention-([\w-]+)\)/g;
export const mentionMarkdown = (name: string, userId: string) =>
  `[@${name.replaceAll(/[[\]]/g, "")}](#mention-${userId})`;
/** A message's text with its mentions as plain "@Name". */
export const plainMentions = (text: string) => text.replaceAll(MENTION_PATTERN, "@$1");
