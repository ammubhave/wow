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
      {/* On a phone the hunt's name gives way (truncates) so the "online" count always fits. */}
      <div className="flex min-w-0 shrink items-center px-1 md:shrink-0">
        <WorkspaceSwitcher workspaceSlug={workspaceSlug} />
      </div>
      <div className="flex h-(--header-height) shrink-0 items-center justify-end gap-2 px-2 md:w-full md:shrink">
        {/* No room on phones for the latest activity (the Activity log is in the menu). */}
        <div className="hidden flex-1 items-center justify-end overflow-hidden md:flex">
          {workspace.activityLogEntries[0] && (
            <div className="flex min-w-0 items-center overflow-hidden px-3">
              <Link
                className={buttonVariants({variant: "ghost"})}
                to="/$workspaceSlug/activity-log"
                params={{workspaceSlug}}>
                <HistoryIcon className="text-muted shrink-0" />
              </Link>
              <ActivityLogItem
                relativeTime
                truncate
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
