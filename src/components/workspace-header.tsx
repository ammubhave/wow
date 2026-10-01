import {Separator, Tabs} from "@heroui/react";
import {useChildMatches} from "@tanstack/react-router";
import {ExternalLinkIcon, InfoIcon, HomeIcon, SettingsIcon, HistoryIcon} from "lucide-react";
import {useEffect} from "react";

import {setLastActivePuzzle} from "@/features/lastActivePuzzle/lastActivePuzzle";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";
import {useAppDispatch, useAppSelector} from "@/store";

import {NavUser} from "./nav-user";
import {NavWorkspace} from "./nav-workspace";
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
  }, [dispatch, newPuzzleId]);
  const lastActivePuzzleId = useAppSelector(state => state.lastActivePuzzle.value);

  const puzzleId = newPuzzleId ?? lastActivePuzzleId;

  const puzzle = workspace.rounds.flatMap(round => round.puzzles).find(p => p.id === puzzleId);

  return (
    <header className="bg-sidebar top-0 z-50 flex w-full items-center border-b">
      <WorkspaceCommandDialog workspaceSlug={workspaceSlug} />
      <div className="flex w-full items-center gap-2">
        <Tabs
          selectedKey={childMatches[1]?.fullPath ?? childMatches[0]?.fullPath}
          className="flex-1 shrink-0">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Workspace navigation">
              <Tabs.Tab id="">
                <img src="/favicon.ico" alt="WOW" className="size-5 shrink-0 rounded-full" />
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="/$workspaceSlug/" href={`/${workspaceSlug}`} aria-label="Home">
                <HomeIcon />
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="/$workspaceSlug/settings"
                href={`/${workspaceSlug}/settings`}
                aria-label="Settings">
                <SettingsIcon />
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="/$workspaceSlug/activity-log"
                href={`/${workspaceSlug}/activity-log`}
                aria-label="Activity log">
                <HistoryIcon />
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab
                id="/$workspaceSlug/help-page"
                href={`/${workspaceSlug}/help-page`}
                aria-label="Help">
                <InfoIcon />
                <Tabs.Indicator />
              </Tabs.Tab>
              {puzzle && (
                // Plain DOM children of a react-aria collection are never rendered, so
                // the separator must live inside the Tab. Force it visible even when
                // this tab is selected (HeroUI hides separators on selected tabs).
                <Tabs.Tab
                  id="/$workspaceSlug/puzzles/$puzzleId"
                  href={`/${workspaceSlug}/puzzles/${puzzle.id}`}>
                  <Tabs.Separator className="opacity-100!" />
                  {puzzle.name}
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <div className="flex items-center gap-1">
          {workspace.links.map(link => (
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="button button--ghost gap-2"
              key={`${link.name}\n${link.url}`}>
              {link.name} <ExternalLinkIcon />
            </a>
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
