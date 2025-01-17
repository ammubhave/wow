import {
  CheckIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  OctagonAlertIcon,
  PuzzleIcon,
} from "lucide-react";
import { Suspense } from "react";
import { useParams } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function Page() {
  return (
    <div className="flex justify-center">
      <div className="flex max-w-4xl flex-1 flex-col gap-4 md:gap-8">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Activity Log</h1>
        </div>
        <div className="w-full flex-1 flex flex-col">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <PageInner />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function PageInner() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [activity] = trpc.workspaces.getActivityLog.useSuspenseQuery(
    workspaceId!,
  );

  return (
    <div className="flow-root">
      <ul role="list" className="space-y-6">
        {activity.map((activityItem, activityItemIdx) => (
          <li key={activityItem.id} className="relative flex gap-x-4">
            <div
              className={cn(
                activityItemIdx === activity.length - 1 ? "h-6" : "-bottom-6",
                "absolute left-0 top-0 flex w-6 justify-center",
              )}
            >
              <div className="w-px bg-gray-200 dark:bg-gray-800" />
            </div>

            <>
              <div className="relative flex size-6 flex-none items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div
                  className={cn(
                    "size-5 rounded-full flex items-center justify-center *:size-3 *:text-gray-100",
                    (activityItem.type === "RoundActivityLogEntry" ||
                      activityItem.type === "PuzzleActivityLogEntry") &&
                      activityItem.subType === "Create" &&
                      "bg-amber-600",
                    (activityItem.type === "RoundActivityLogEntry" ||
                      activityItem.type === "PuzzleActivityLogEntry") &&
                      activityItem.subType === "Delete" &&
                      "bg-rose-600",
                    activityItem.type === "PuzzleActivityLogEntry" &&
                      (activityItem.subType === "UpdateStatus" ||
                        activityItem.subType === "UpdateImportance") &&
                      "bg-teal-600",
                    activityItem.type === "PuzzleActivityLogEntry" &&
                      activityItem.subType === "UpdateAnswer" &&
                      "bg-sky-600",
                  )}
                >
                  {activityItem.type === "RoundActivityLogEntry" &&
                    activityItem.subType === "Create" && (
                      <FolderPlusIcon aria-hidden="true" />
                    )}
                  {activityItem.type === "RoundActivityLogEntry" &&
                    activityItem.subType === "Delete" && (
                      <FolderMinusIcon aria-hidden="true" />
                    )}
                  {activityItem.type === "PuzzleActivityLogEntry" &&
                    (activityItem.subType === "UpdateStatus" &&
                    (activityItem.field === "solved" ||
                      activityItem.field === "backsolved" ||
                      activityItem.field === "obsolete") ? (
                      <CheckIcon aria-hidden="true" />
                    ) : activityItem.field === "stuck" ||
                      activityItem.field === "very_stuck" ||
                      activityItem.field === "pending" ? (
                      <OctagonAlertIcon aria-hidden="true" />
                    ) : (
                      <PuzzleIcon aria-hidden="true" />
                    ))}
                </div>
              </div>
              <p className="flex-auto py-0.5 text-xs/5 text-gray-500">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {activityItem.user.firstName}
                </span>{" "}
                {activityItem.subType === "Create"
                  ? "created"
                  : activityItem.subType === "Delete"
                    ? "deleted"
                    : activityItem.subType === "UpdateStatus"
                      ? "updated the status of"
                      : activityItem.subType === "UpdateAnswer"
                        ? "updated the answer of"
                        : "updated the importance of"}{" "}
                {activityItem.type === "RoundActivityLogEntry"
                  ? "round"
                  : "puzzle"}{" "}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {activityItem.type === "RoundActivityLogEntry" &&
                    activityItem.roundName}
                  {activityItem.type === "PuzzleActivityLogEntry" &&
                    activityItem.puzzleName}
                </span>
                {(activityItem.subType === "UpdateStatus" ||
                  activityItem.subType === "UpdateImportance" ||
                  activityItem.subType === "UpdateAnswer") && (
                  <>
                    {" "}
                    to{" "}
                    <span
                      className={cn(
                        "font-medium text-gray-900 dark:text-gray-100",
                        activityItem.subType === "UpdateAnswer" && "font-mono",
                      )}
                    >
                      {activityItem.field?.[0]?.toLocaleUpperCase()}
                      {activityItem.field?.slice(1)}
                    </span>
                  </>
                )}
              </p>
              <time
                dateTime={activityItem.createdAt}
                className="flex-none py-0.5 text-xs/5 text-gray-500"
              >
                {new Date(activityItem.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </time>
            </>
          </li>
        ))}
      </ul>
    </div>
  );
}
