import {Link, useParams} from "@tanstack/react-router";
import {
  CheckIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  LogInIcon,
  OctagonAlertIcon,
  PuzzleIcon,
} from "lucide-react";
import {memo} from "react";
import {cn} from "tailwind-variants";
import {useFormatter, useNow} from "use-intl";

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
  return format.relativeTime(new Date(date), now);
}

export const ActivityLogItem = memo(function ActivityLogItem({
  activityItem,
  showIcon = true,
  relativeTime = false,
}: {
  activityItem: WorkspaceRoomState["activityLogEntries"][0];
  showIcon?: boolean;
  relativeTime?: boolean;
}) {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const format = useFormatter();
  return (
    <div className="flex items-center gap-x-4">
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
      <p className="text-muted flex-auto py-0.5 text-xs/5">
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
                  <span className="font-mono">{activityItem.puzzle_activity_log_entry.field}</span>
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
