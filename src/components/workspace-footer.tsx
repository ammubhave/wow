import {Link} from "@tanstack/react-router";
import {HistoryIcon} from "lucide-react";

import {PresencesCard} from "@/components/presences-card";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";

import {ActivityLogItem} from "./activity-log";
import {Button} from "./ui/button";

export function WorkspaceFooter() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  return (
    <footer className="bg-sidebar flex w-full items-center border-t">
      <div className="px-2 flex items-center gap-4 shrink-0">
        <div className="flex-1 font-semibold items-center gap-2 flex">
          <span className="text-xs text-nowrap">{workspace.eventName}</span>
          <span>•</span>
          <span className="text-xs text-nowrap">{workspace.teamName}</span>
        </div>
      </div>
      <div className="flex h-(--header-height) w-full items-center gap-2 px-2">
        <div className="flex-1 flex items-center overflow-hidden justify-end">
          {workspace.activityLogEntries[0] && (
            <div className="overflow-hidden px-3 flex items-center">
              <Button
                variant="ghost"
                nativeButton={false}
                render={
                  <Link to="/$workspaceSlug/activity-log" params={{workspaceSlug}}>
                    <HistoryIcon className="text-muted-foreground shrink-0" />
                  </Link>
                }
              />
              <ActivityLogItem
                relativeTime
                showIcon={false}
                activityItem={workspace.activityLogEntries[0]}
              />
            </div>
          )}
        </div>
        <PresencesCard id={workspaceSlug} />
      </div>
    </footer>
  );
}
