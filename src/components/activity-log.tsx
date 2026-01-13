import {useQuery} from "@tanstack/react-query";
import {Link} from "@tanstack/react-router";
import {
  CheckIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  LogInIcon,
  OctagonAlertIcon,
  PuzzleIcon,
  SignalHighIcon,
  SignalIcon,
  SignalLowIcon,
  SignalMediumIcon,
  SignalZeroIcon,
} from "lucide-react";
import {useFormatter, useNow} from "use-intl";

import {Skeleton} from "@/components/ui/skeleton";
import {orpc} from "@/lib/orpc";
import {cn} from "@/lib/utils";
import {RouterOutputs} from "@/server/router";

import {UserHoverCard} from "./user-hover-card";

export function ActivityLogItem({
  activityItem,
  showIcon = true,
  relativeTime = false,
}: {
  activityItem: RouterOutputs["workspaces"]["activityLog"]["get"][0];
  showIcon?: boolean;
  relativeTime?: boolean;
}) {
  const now = useNow({updateInterval: 1000});
  const format = useFormatter();
  return (
    <div className="flex gap-x-4 items-center">
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
      <p className="flex-auto py-0.5 text-xs/5 text-muted-foreground line-clamp-1">
        {activityItem.user && (
          <UserHoverCard user={activityItem.user}>
            <span className="cursor-default hover:text-muted-foreground font-medium text-foreground">
              {activityItem.user.displayUsername}
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
            <Link
              to="/$workspaceId/puzzles/$puzzleId"
              params={{puzzleId: activityItem.puzzle_activity_log_entry.puzzleId} as any}
              className="font-medium text-foreground">
              {activityItem.puzzle_activity_log_entry.puzzleName}
            </Link>
            {activityItem.puzzle_activity_log_entry.field !== null && (
              <>
                {" "}
                to{" "}
                {activityItem.puzzle_activity_log_entry.subType === "updateImportance" ? (
                  activityItem.puzzle_activity_log_entry.field === "veryhigh" ? (
                    <SignalIcon className="py-1 inline" />
                  ) : activityItem.puzzle_activity_log_entry.field === "high" ? (
                    <SignalHighIcon className="py-1 inline" />
                  ) : activityItem.puzzle_activity_log_entry.field === "medium" ? (
                    <SignalMediumIcon className="py-1 inline" />
                  ) : activityItem.puzzle_activity_log_entry.field === "low" ? (
                    <SignalLowIcon className="py-1 inline" />
                  ) : activityItem.puzzle_activity_log_entry.field === "obsolete" ? (
                    <SignalZeroIcon className="py-1 inline" />
                  ) : (
                    activityItem.puzzle_activity_log_entry.field
                  )
                ) : activityItem.puzzle_activity_log_entry.subType === "updateAnswer" ? (
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
            <span className="font-medium text-foreground">
              {activityItem.round_activity_log_entry.roundName}
            </span>
          </>
        )}{" "}
      </p>
      <time
        dateTime={activityItem.activity_log_entry.createdAt.toString()}
        className="flex-none py-0.5 text-xs/5 text-muted-foreground">
        {relativeTime
          ? format.relativeTime(activityItem.activity_log_entry.createdAt, now)
          : activityItem.activity_log_entry.createdAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "numeric",
            })}
      </time>
    </div>
  );
}

export function ActivityLog({workspaceId}: {workspaceId: string}) {
  const activityLogEntries = useQuery(
    orpc.workspaces.activityLog.get.queryOptions({input: {workspaceId}})
  ).data;
  if (activityLogEntries === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }
  return (
    <div className="flex justify-center">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Activity Log</h1>
        </div>
        <div className="w-full flex-1 flex flex-col">
          <div className="flow-root">
            <ul role="list" className="space-y-6">
              {activityLogEntries.map((activityItem, activityItemIdx) => (
                <li key={activityItem.activity_log_entry.id} className="relative flex gap-x-4">
                  <div
                    className={cn(
                      activityItemIdx === activityLogEntries.length - 1 ? "h-6" : "-bottom-6",
                      "absolute left-0 top-0 flex w-6 justify-center"
                    )}>
                    <div className="w-px bg-border" />
                  </div>
                  <ActivityLogItem activityItem={activityItem} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
