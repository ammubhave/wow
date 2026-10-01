import {buttonVariants} from "@heroui/react";
import {Link} from "@tanstack/react-router";
import {HistoryIcon} from "lucide-react";

import {PresencesCard} from "@/components/presences-card";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";

import {ActivityLogItem} from "./activity-log";
import {WorkspaceSwitcher} from "./nav-workspace";

export function WorkspaceFooter() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  return (
    <footer className="bg-background flex w-full items-center border-t">
      <div className="flex min-w-0 shrink-0 items-center px-1">
        <WorkspaceSwitcher workspaceSlug={workspaceSlug} />
      </div>
      <div className="flex h-(--header-height) w-full items-center gap-2 px-2">
        <div className="flex flex-1 items-center justify-end overflow-hidden">
          {workspace.activityLogEntries[0] && (
            <div className="flex items-center overflow-hidden px-3">
              <Link
                className={buttonVariants({variant: "ghost"})}
                to="/$workspaceSlug/activity-log"
                params={{workspaceSlug}}>
                <HistoryIcon className="text-muted shrink-0" />
              </Link>
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
