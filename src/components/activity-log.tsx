import {Link, useParams} from "@tanstack/react-router";
import {
  CheckIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  LogInIcon,
  OctagonAlertIcon,
  PuzzleIcon,
} from "lucide-react";
import {memo, useState} from "react";
import {cn} from "tailwind-variants";
import {useFormatter, useNow} from "use-intl";

import {formatAnswers} from "@/lib/answers";
import type {WorkspaceRoomState} from "@/server/do/workspace";

import {UserHoverCard} from "./user-hover-card";

/**
 * "5 minutes ago"-style text that keeps itself current. The ticking clock lives here, not in the
 * caller, so only this text re-renders on each tick. Relative-time output is coarse (seconds only
 * for the first minute), so a 10s tick is plenty.
 */
export function RelativeTime({date}: {date: Date | string | number}) {
  const now = useNow({updateInterval: 10_000});
  const format = useFormatter();
  const at = new Date(date);
  // The server's clock can run a little ahead of this computer's: never say "in 4 seconds" for
  // something that already happened.
  if (at.getTime() > now.getTime() - 5_000) return "just now";
  return format.relativeTime(at, now);
}

export const ActivityLogItem = memo(function ActivityLogItem({
  activityItem,
  showIcon = true,
  relativeTime = false,
  truncate = false,
}: {
  activityItem: WorkspaceRoomState["activityLogEntries"][0];
  showIcon?: boolean;
  relativeTime?: boolean;
  /** On one line, cut off with "…" when it doesn't fit, and shown in full on hover. */
  truncate?: boolean;
}) {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const format = useFormatter();
  // The whole sentence, as a native tooltip, only while it's cut off. (A tooltip component would
  // wrap the text's own links and name card in a button.)
  const [fullText, setFullText] = useState<string>();
  return (
    <div className={cn("flex items-center gap-x-4", truncate && "min-w-0")}>
      {showIcon && (
        <div className="relative flex size-6 flex-none items-center justify-center">
          <div
            className={cn(
              "size-5 rounded-full flex items-center justify-center *:size-3 *:text-gray-100",
              (activityItem.round_activity_log_entry?.subType === "create" ||
                activityItem.puzzle_activity_log_entry?.subType === "create") &&
                "bg-amber-600",
              (activityItem.round_activity_log_entry?.subType === "delete" ||
                activityItem.puzzle_activity_log_entry?.subType === "delete") &&
                "bg-rose-600",
              (activityItem.puzzle_activity_log_entry?.subType === "updateStatus" ||
                activityItem.puzzle_activity_log_entry?.subType === "updateImportance") &&
                "bg-teal-600",
              activityItem.puzzle_activity_log_entry?.subType === "updateAnswer" && "bg-sky-600",
              activityItem.workspace_activity_log_entry?.subType === "join" && "bg-emerald-600"
            )}>
            {(activityItem.round_activity_log_entry?.subType === "create" ||
              activityItem.puzzle_activity_log_entry?.subType === "create") && (
              <FolderPlusIcon aria-hidden="true" />
            )}
            {(activityItem.round_activity_log_entry?.subType === "delete" ||
              activityItem.puzzle_activity_log_entry?.subType === "delete") && (
              <FolderMinusIcon aria-hidden="true" />
            )}
            {activityItem.puzzle_activity_log_entry?.subType === "updateStatus" &&
              (activityItem.puzzle_activity_log_entry.field === "solved" ||
              activityItem.puzzle_activity_log_entry.field === "backsolved" ||
              activityItem.puzzle_activity_log_entry.field === "obsolete" ? (
                <CheckIcon aria-hidden="true" />
              ) : activityItem.puzzle_activity_log_entry.field === "stuck" ||
                activityItem.puzzle_activity_log_entry.field === "very_stuck" ||
                activityItem.puzzle_activity_log_entry.field === "pending" ? (
                <OctagonAlertIcon aria-hidden="true" />
              ) : (
                <PuzzleIcon aria-hidden="true" />
              ))}
            {(activityItem.puzzle_activity_log_entry?.subType === "updateImportance" ||
              activityItem.puzzle_activity_log_entry?.subType === "updateAnswer") && (
              <PuzzleIcon aria-hidden="true" />
            )}
            {activityItem.workspace_activity_log_entry?.subType === "join" && (
              <LogInIcon aria-hidden="true" />
            )}
          </div>
        </div>
      )}
      <p
        className={cn("text-muted flex-auto py-0.5 text-xs/5", truncate && "min-w-0 truncate")}
        title={truncate ? fullText : undefined}
        onPointerEnter={
          truncate
            ? event => {
                const text = event.currentTarget;
                setFullText(
                  text.scrollWidth > text.clientWidth ? text.textContent.trim() : undefined
                );
              }
            : undefined
        }>
        {activityItem.user && (
          <UserHoverCard user={activityItem.user}>
            <span className="hover:text-muted text-foreground cursor-default font-medium">
              {activityItem.user.name}
            </span>
          </UserHoverCard>
        )}{" "}
        {activityItem.workspace_activity_log_entry?.subType === "join" && "joined the workspace"}
        {activityItem.puzzle_activity_log_entry && (
          <>
            {activityItem.puzzle_activity_log_entry.subType === "create"
              ? "created"
              : activityItem.puzzle_activity_log_entry.subType === "delete"
                ? "deleted"
                : activityItem.puzzle_activity_log_entry.subType === "updateStatus"
                  ? "updated the status of"
                  : activityItem.puzzle_activity_log_entry.subType === "updateImportance"
                    ? "updated the importance of"
                    : activityItem.puzzle_activity_log_entry.subType === "updateAnswer"
                      ? "updated the answer of"
                      : ""}{" "}
            {activityItem.puzzle_activity_log_entry.puzzleId ? (
              <Link
                to="/$workspaceSlug/puzzles/$puzzleId"
                params={{workspaceSlug, puzzleId: activityItem.puzzle_activity_log_entry.puzzleId}}
                className="text-foreground font-medium">
                {activityItem.puzzle_activity_log_entry.puzzleName}
              </Link>
            ) : (
              <span className="text-foreground font-medium">
                {activityItem.puzzle_activity_log_entry.puzzleName}
              </span>
            )}
            {activityItem.puzzle_activity_log_entry.field !== null && (
              <>
                {" "}
                to{" "}
                {activityItem.puzzle_activity_log_entry.subType === "updateAnswer" ? (
                  <span className="font-mono">
                    {formatAnswers(activityItem.puzzle_activity_log_entry.field)}
                  </span>
                ) : (
                  activityItem.puzzle_activity_log_entry.field
                )}
              </>
            )}
          </>
        )}
        {activityItem.round_activity_log_entry && (
          <>
            {activityItem.round_activity_log_entry.subType === "create"
              ? "created"
              : activityItem.round_activity_log_entry.subType === "delete"
                ? "deleted"
                : ""}{" "}
            <span className="text-foreground font-medium">
              {activityItem.round_activity_log_entry.roundName}
            </span>
          </>
        )}{" "}
      </p>
      <time
        dateTime={activityItem.activity_log_entry.createdAt.toString()}
        className="text-muted flex-none py-0.5 text-xs/5">
        {relativeTime ? (
          <RelativeTime date={activityItem.activity_log_entry.createdAt} />
        ) : (
          // Arrives as an ISO string over the workspace websocket (JSON), despite the Date type.
          format.dateTime(new Date(activityItem.activity_log_entry.createdAt), {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
          })
        )}
      </time>
    </div>
  );
});
