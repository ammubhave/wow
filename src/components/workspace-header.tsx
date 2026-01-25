import {Link, useChildMatches} from "@tanstack/react-router";
import {ExternalLinkIcon, InfoIcon, SettingsIcon, HistoryIcon} from "lucide-react";
import {useEffect} from "react";

import {PresencesCard} from "@/components/presences-card";
import {Separator} from "@/components/ui/separator";
import {useSidebar} from "@/components/ui/sidebar";
import {setLastActivePuzzle} from "@/features/lastActivePuzzle/lastActivePuzzle";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";
import {useAppDispatch, useAppSelector} from "@/store";

import {ActivityLogItem} from "./activity-log";
import {NavUser} from "./nav-user";
import {NavWorkspace} from "./nav-workspace";
import {Button} from "./ui/button";
import {DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator} from "./ui/dropdown-menu";
import {Tabs, TabsList, TabsTrigger} from "./ui/tabs";
import {WorkspaceCommandDialog} from "./workspace-command-dialog";

export function WorkspaceHeader() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const {isMobile} = useSidebar();
  const childMatches = useChildMatches();
  const match = childMatches[childMatches.length - 1]!;

  const newPuzzleId =
    match.routeId === "/_workspace/$workspaceSlug/puzzles/$puzzleId"
      ? match.params.puzzleId
      : undefined;
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (newPuzzleId) {
      dispatch(setLastActivePuzzle(newPuzzleId));
    }
  }, [newPuzzleId]);
  const lastActivePuzzleId = useAppSelector(state => state.lastActivePuzzle.value);

  const puzzleId = newPuzzleId ?? lastActivePuzzleId;

  const puzzle = workspace.rounds.flatMap(round => round.puzzles).find(p => p.id === puzzleId);

  return (
    <header className="bg-sidebar top-0 z-50 flex w-full items-center border-b">
      <WorkspaceCommandDialog workspaceSlug={workspaceSlug} />
      <div className="flex h-(--header-height) w-full items-center gap-2 px-2">
        <Tabs
          value={childMatches[1]?.fullPath ?? childMatches[0]?.fullPath}
          className="flex flex-col shrink-0">
          <div className="justify-between flex items-center gap-2">
            <div className="px-2 flex items-center gap-4 shrink-0">
              <Link to="/workspaces" className="shrink-0">
                <img src="/favicon.ico" className="size-6 rounded-full" />
              </Link>
              <div className="flex-1 font-semibold flex-col flex">
                <span className="text-sm text-nowrap">{workspace.eventName}</span>
                <span className="text-xs text-nowrap">{workspace.teamName}</span>
              </div>
            </div>
            <TabsList>
              <TabsTrigger
                value="/$workspaceSlug/"
                render={
                  <Link to="/$workspaceSlug" params={{workspaceSlug}}>
                    Home
                  </Link>
                }
              />
              <TabsTrigger
                value="/$workspaceSlug/settings"
                render={
                  <Link to="/$workspaceSlug/settings" params={{workspaceSlug}}>
                    <SettingsIcon />
                  </Link>
                }
              />
              <TabsTrigger
                value="/$workspaceSlug/activity-log"
                render={
                  <Link to="/$workspaceSlug/activity-log" params={{workspaceSlug}}>
                    <HistoryIcon />
                  </Link>
                }
              />
              <TabsTrigger
                value="/$workspaceSlug/help-page"
                render={
                  <Link to="/$workspaceSlug/help-page" params={{workspaceSlug}}>
                    <InfoIcon />
                  </Link>
                }
              />
              {puzzle && (
                <>
                  <div className="w-full h-full px-1">
                    <Separator orientation="vertical" />
                  </div>
                  <TabsTrigger
                    value="/$workspaceSlug/puzzles/$puzzleId"
                    render={
                      <Link
                        to="/$workspaceSlug/puzzles/$puzzleId"
                        params={{workspaceSlug, puzzleId: puzzle.id}}>
                        {puzzle.name}
                      </Link>
                    }
                  />
                </>
              )}
            </TabsList>
          </div>
        </Tabs>
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
        <div className="flex items-center gap-1">
          {workspace.links.map((link, index) => (
            <Button
              key={index}
              nativeButton={false}
              variant="ghost"
              render={
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                  {link.name} <ExternalLinkIcon />
                </a>
              }
            />
          ))}
        </div>
        <Separator orientation="vertical" />
        <NavUser>
          {isMobile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {workspace.links.map((link, index) => (
                  <DropdownMenuItem
                    key={index}
                    render={
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gap-2 justify-between">
                        {link.name} <ExternalLinkIcon />
                      </a>
                    }
                  />
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <NavWorkspace workspaceSlug={workspaceSlug} />
        </NavUser>
      </div>
    </header>
  );
}
