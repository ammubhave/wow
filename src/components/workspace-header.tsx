import {useQuery} from "@tanstack/react-query";
import {createFileRoute, Link, useChildMatches, useNavigate} from "@tanstack/react-router";
import {ExternalLinkIcon, Info, Settings, History} from "lucide-react";
import {useEffect} from "react";

import {PresencesCard} from "@/components/presences-card";
import {Separator} from "@/components/ui/separator";
import {useSidebar} from "@/components/ui/sidebar";
import {setLastActivePuzzle} from "@/features/lastActivePuzzle/lastActivePuzzle";
import {orpc} from "@/lib/orpc";
import {useAppDispatch, useAppSelector} from "@/store";

import {ActivityLogItem} from "./activity-log";
import {NavUser} from "./nav-user";
import {NavWorkspace} from "./nav-workspace";
import {Button} from "./ui/button";
import {DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator} from "./ui/dropdown-menu";
import {Tabs, TabsList, TabsTrigger} from "./ui/tabs";
import {useWorkspace} from "./use-workspace";
import {WorkspaceCommandDialog} from "./workspace-command-dialog";
export const Route = createFileRoute("/_workspace/$workspaceId/_home")({
  component: WorkspaceHeader,
});

export function WorkspaceHeader() {
  const {workspaceId} = Route.useParams();
  const workspace = useWorkspace({workspaceId});
  const {isMobile} = useSidebar();
  const childMatches = useChildMatches();
  const match = childMatches[childMatches.length - 1]!;

  const newPuzzleId =
    match.routeId === "/_workspace/$workspaceId/puzzles/$puzzleId"
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

  const puzzle = workspace.rounds.list.data
    .flatMap(round => round.puzzles)
    .find(p => p.id === puzzleId);
  const activityLogEntries = useQuery(
    orpc.workspaces.activityLog.get.queryOptions({input: {workspaceId}})
  ).data;
  const navigate = useNavigate();

  return (
    <header className="bg-sidebar top-0 z-50 flex w-full items-center border-b">
      <WorkspaceCommandDialog workspaceId={workspaceId} />
      <div className="flex h-(--header-height) w-full items-center gap-2 px-2">
        <Tabs
          value={childMatches[1]?.fullPath ?? childMatches[0]?.fullPath}
          onValueChange={(to: string) => {
            void navigate({
              to,
              params: to === "/$workspaceId/puzzles/$puzzleId" ? {puzzleId} : undefined,
            });
          }}
          className="flex flex-col shrink-0">
          <div className="justify-between flex items-center gap-2">
            <div className="px-2 flex items-center gap-4 shrink-0">
              <Link to="/workspaces" className="shrink-0">
                <img src="/favicon.ico" className="size-6 rounded-full" />
              </Link>
              <div className="contents flex-1 text-lg font-semibold">
                <span className="font-semi-bold text-lg text-nowrap">
                  {workspace.get.data.teamName}
                </span>
              </div>
            </div>
            <TabsList>
              <TabsTrigger value="/$workspaceId/" className="px-2 flex items-center gap-4">
                Home
              </TabsTrigger>
              <TabsTrigger value="/$workspaceId/settings" className="px-2">
                <Settings className="ml-auto" />
              </TabsTrigger>
              <TabsTrigger value="/$workspaceId/activity-log" className="px-2">
                <History className="ml-auto" />
              </TabsTrigger>
              <TabsTrigger value="/$workspaceId/help-page" className="px-2">
                <Info className="ml-auto" />
              </TabsTrigger>
              {puzzle && (
                <div className="w-full h-full px-1">
                  <Separator orientation="vertical" />
                </div>
              )}
              {puzzle && (
                <TabsTrigger value="/$workspaceId/puzzles/$puzzleId" className="px-2">
                  {puzzle.name}
                </TabsTrigger>
              )}
            </TabsList>
          </div>
        </Tabs>
        <div className="flex-1 flex items-center overflow-hidden justify-end">
          {activityLogEntries?.[0] && (
            <div className="overflow-hidden px-3 flex items-center">
              <Button
                variant="ghost"
                nativeButton={false}
                render={
                  <Link to="/$workspaceId/activity-log" params={{workspaceId}}>
                    <History className="size-4 text-muted-foreground shrink-0" />
                  </Link>
                }
              />
              <ActivityLogItem
                relativeTime
                showIcon={false}
                activityItem={activityLogEntries?.[0]}
              />
            </div>
          )}
        </div>
        <PresencesCard id={workspaceId} />
        <div className="flex items-center gap-1">
          {(workspace.get.data.links as {name: string; url: string}[] | undefined)?.map(
            (link, index) => (
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
            )
          )}
        </div>
        <Separator orientation="vertical" />
        <NavUser>
          {isMobile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {(workspace.get.data.links as {name: string; url: string}[] | undefined)?.map(
                  (link, index) => (
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
                  )
                )}
              </DropdownMenuGroup>
            </>
          )}
          <NavWorkspace workspaceId={workspaceId} />
        </NavUser>
      </div>
    </header>
  );
}
