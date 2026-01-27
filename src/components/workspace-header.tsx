import {Link, useChildMatches} from "@tanstack/react-router";
import {ExternalLinkIcon, InfoIcon, HomeIcon, SettingsIcon, HistoryIcon} from "lucide-react";
import {useEffect} from "react";

import {Separator} from "@/components/ui/separator";
import {setLastActivePuzzle} from "@/features/lastActivePuzzle/lastActivePuzzle";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";
import {useAppDispatch, useAppSelector} from "@/store";

import {NavUser} from "./nav-user";
import {NavWorkspace} from "./nav-workspace";
import {Button} from "./ui/button";
import {Tabs, TabsList, TabsTrigger} from "./ui/tabs";
import {WorkspaceCommandDialog} from "./workspace-command-dialog";

export function WorkspaceHeader() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
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
      <div className="flex w-full items-center gap-2">
        <Tabs
          value={childMatches[1]?.fullPath ?? childMatches[0]?.fullPath}
          className="flex flex-col shrink-0 flex-1">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger
                value=""
                render={
                  <div>
                    <img src="/favicon.ico" className="size-5 shrink-0 rounded-full" />
                  </div>
                }
              />
              <TabsTrigger
                value="/$workspaceSlug/"
                render={
                  <Link to="/$workspaceSlug" params={{workspaceSlug}}>
                    <HomeIcon />
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
          <NavWorkspace workspaceSlug={workspaceSlug} />
        </NavUser>
      </div>
    </header>
  );
}
