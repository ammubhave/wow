import {Navbar} from "@heroui-pro/react";
import {Tabs} from "@heroui/react";
import {Link, useChildMatches} from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  HistoryIcon,
  HomeIcon,
  InfoIcon,
  PuzzleIcon,
  SettingsIcon,
} from "lucide-react";
import {useEffect} from "react";

import {setLastActivePuzzle} from "@/features/lastActivePuzzle/lastActivePuzzle";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";
import {useAppDispatch, useAppSelector} from "@/store";

import {NavUser} from "./nav-user";
import {WorkspaceCommandDialog} from "./workspace-command-dialog";

// Icon-only on purpose: these are the least-used destinations. Hunt links and the current puzzle
// are what solvers reach for, so those get the labels and the space.
const SECTIONS = [
  {routeId: "/$workspaceSlug/", path: "", label: "Blackboard", Icon: HomeIcon},
  {routeId: "/$workspaceSlug/settings", path: "/settings", label: "Settings", Icon: SettingsIcon},
  {
    routeId: "/$workspaceSlug/activity-log",
    path: "/activity-log",
    label: "Activity log",
    Icon: HistoryIcon,
  },
  {routeId: "/$workspaceSlug/help-page", path: "/help-page", label: "Help", Icon: InfoIcon},
] as const;

export function WorkspaceHeader() {
  const {workspaceSlug} = Route.useParams();
  const workspace = useWorkspace();
  const childMatches = useChildMatches();
  const match = childMatches[childMatches.length - 1]!;
  const currentSection = childMatches[1]?.fullPath ?? childMatches[0]?.fullPath;

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
  const puzzleHref = puzzle && `/${workspaceSlug}/puzzles/${puzzle.id}`;

  return (
    <Navbar aria-label="Workspace" maxWidth="full" size="sm" shouldBlockScroll={false}>
      <Navbar.Header>
        <Navbar.MenuToggle className="md:hidden" />
        <Navbar.Brand>
          <Link to="/workspaces" aria-label="All workspaces">
            <img src="/favicon.ico" alt="" className="size-5 rounded-full" />
          </Link>
        </Navbar.Brand>
        {/* Real links (⌘/middle-click work) with a segmented look. Sections are icon-only except the
            current one, which also shows its label; the current puzzle always shows its name. */}
        <Tabs selectedKey={newPuzzleId ? "puzzle" : currentSection} className="hidden md:flex">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Workspace sections" className="w-fit">
              {SECTIONS.map(({routeId, path, label, Icon}) => (
                <Tabs.Tab
                  key={routeId}
                  className="w-auto flex-none whitespace-nowrap"
                  id={routeId}
                  href={`/${workspaceSlug}${path}`}
                  aria-label={label}>
                  {({isSelected}) => (
                    <>
                      <Icon className="size-4 shrink-0" />
                      {isSelected && <span className="ms-1.5">{label}</span>}
                      <Tabs.Indicator />
                    </>
                  )}
                </Tabs.Tab>
              ))}
              {puzzle && puzzleHref && (
                <Tabs.Tab
                  id="puzzle"
                  href={puzzleHref}
                  className="w-auto min-w-0 flex-none whitespace-nowrap">
                  <Tabs.Separator className="opacity-100!" />
                  <PuzzleIcon className="size-4 shrink-0" />
                  <span className="ms-1.5 max-w-64 truncate">{puzzle.name}</span>
                  <Tabs.Indicator />
                </Tabs.Tab>
              )}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
        <Navbar.Spacer />
        <Navbar.Content className="min-w-0">
          {workspace.links.map(link => (
            <Navbar.Item
              key={`${link.name}\n${link.url}`}
              href={link.url}
              className="text-foreground">
              <Navbar.Label>{link.name}</Navbar.Label>
              <ExternalLinkIcon data-slot="icon" />
            </Navbar.Item>
          ))}
          <WorkspaceCommandDialog workspaceSlug={workspaceSlug} />
          <Navbar.Separator />
          <NavUser />
        </Navbar.Content>
      </Navbar.Header>
      <Navbar.Menu>
        {puzzle && puzzleHref && (
          <Navbar.MenuItem href={puzzleHref} isCurrent={newPuzzleId === puzzle.id}>
            {puzzle.name}
          </Navbar.MenuItem>
        )}
        {SECTIONS.map(({routeId, path, label}) => (
          <Navbar.MenuItem
            key={routeId}
            href={`/${workspaceSlug}${path}`}
            isCurrent={currentSection === routeId}>
            {label}
          </Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
}
