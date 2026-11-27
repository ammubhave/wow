import {formatAnswers} from "@/lib/answers";
import {getPuzzleStatusOptions} from "@/lib/puzzleStatuses";
import type {WorkspaceNotification} from "@/server/notifications";

const statusLabel = (status: string | null) =>
  getPuzzleStatusOptions().find(option => option.value === status)?.label ?? status ?? "None";

/** What happened on a starred puzzle, as a sentence. */
function describeFavorite(change: Extract<WorkspaceNotification, {type: "favorite"}>["change"]) {
  switch (change.kind) {
    case "status":
      return `Now ${statusLabel(change.status)}`;
    case "guessQueued":
      return `Guess queued: ${change.answer}`;
    case "guessResult":
      return change.result === "partial"
        ? `${change.answer}: keep going (partial)`
        : `${change.answer} was wrong`;
    default:
      return change satisfies never;
  }
}

export const driveFolderUrl = (folderId: string) =>
  `https://drive.google.com/drive/folders/${folderId}`;

/**
 * What a notification says, as a title and a line under it: the same words in the bell, its
 * pop-ups and desktop notifications, and Web Push (src/server/push.ts).
 */
export function describe(notification: WorkspaceNotification) {
  switch (notification.type) {
    case "solved":
      return {
        // A team effort: who marked it solved isn't who solved it, so no "by".
        title: `${notification.isMeta ? "Meta solved" : "Solved"}: ${notification.puzzleName}`,
        body: formatAnswers(notification.answer),
      };
    case "announcement":
      return {title: `Announcement from ${notification.from}`, body: notification.message};
    case "mention":
      return {
        title: `${notification.from.name} mentioned you in ${notification.puzzleName}`,
        body: notification.text,
      };
    case "email":
      return {
        title: `Email from ${notification.from}`,
        body: [notification.subject, notification.preview].filter(Boolean).join(" — "),
      };
    case "favorite":
      return {
        title: `${notification.puzzleName}: ${describeFavorite(notification.change)}`,
        body: `By ${notification.by.name} · you starred it`,
      };
    case "driveShareFailed":
      // What to do first: the bell shows only two lines.
      return notification.access === "unshare"
        ? {
            title: `Couldn't remove ${notification.member.name} from the Google Drive folder`,
            body: `Stop sharing it with ${notification.member.email} in Google Drive. ${notification.detail}`,
          }
        : {
            title: `Couldn't share the Google Drive folder with ${notification.member.name}`,
            body: `Share it with ${notification.member.email} in Google Drive. ${notification.detail}`,
          };
    default:
      return notification satisfies never;
  }
}

/**
 * Where opening a notification takes you, from a push (the bell goes to the same places, by the
 * router): the puzzle (for a mention, its chat), the blackboard for the team chat, the email in the
 * Inbox, the Google Drive file or folder to share, or the blackboard for an announcement.
 */
export function notificationUrl(workspaceSlug: string, notification: WorkspaceNotification) {
  const workspace = `/${encodeURIComponent(workspaceSlug)}`;
  switch (notification.type) {
    case "announcement":
      return workspace;
    case "email":
      return `${workspace}/inbox?email=${encodeURIComponent(notification.emailId)}`;
    case "driveShareFailed":
      return notification.blockingFileId
        ? `https://drive.google.com/open?id=${encodeURIComponent(notification.blockingFileId)}`
        : driveFolderUrl(notification.folderId);
    case "mention":
      return notification.puzzleId === null
        ? workspace
        : `${workspace}/puzzles/${encodeURIComponent(notification.puzzleId)}?view=chat`;
    case "solved":
    case "favorite":
      return `${workspace}/puzzles/${encodeURIComponent(notification.puzzleId)}`;
    default:
      return notification satisfies never;
  }
}
