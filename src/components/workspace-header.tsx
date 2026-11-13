import {Navbar} from "@heroui-pro/react";
import {Tabs, Tooltip} from "@heroui/react";
import {Link, useChildMatches} from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  HistoryIcon,
  HomeIcon,
  InfoIcon,
  PuzzleIcon,
  SettingsIcon,
} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {setLastActivePuzzle} from "@/features/lastActivePuzzle/lastActivePuzzle";
import {NotificationBell} from "@/features/notifications/notifications";
import {LobbyButton} from "@/features/voice/voice-ui";
import {useWorkspace} from "@/hooks/use-workspace";
import {Route} from "@/routes/_workspace/$workspaceSlug";
import {useAppDispatch, useAppSelector} from "@/store";

import {HuntClock} from "./hunt-clock";
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

// How long the pointer rests on an icon before its name shows (like the app's other tooltips).
const HINT_DELAY_MS = 300;

/**
 * The name of the section tab under the pointer, after a short pause. Tabs live in a collection,
 * so they can't be wrapped in a tooltip trigger: one tooltip is anchored to whichever is hovered.
 */
function useSectionHint() {
  const tabs = useRef(new Map<string, HTMLElement>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [hint, setHint] = useState<{id: string; anchor: HTMLElement} | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onHoverChange = (id: string, hovering: boolean) => {
    clearTimeout(timer.current);
    if (hovering) {
      timer.current = setTimeout(() => {
        const anchor = tabs.current.get(id);
        if (anchor) setHint({id, anchor});
      }, HINT_DELAY_MS);
    } else setHint(current => (current?.id === id ? null : current));
  };
  const tabRef = (id: string) => (element: HTMLElement | null) => {
    if (element) tabs.current.set(id, element);
    else tabs.current.delete(id);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setHint(null);
  };
  // The tooltip closing itself (Escape) hides it without cancelling a hint that's on its way.
  const dismiss = () => setHint(null);
  return {hint: hint?.id ?? null, anchor: hint?.anchor, onHoverChange, tabRef, hide, dismiss};
}

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
  const sectionHint = useSectionHint();
  const selectedKey = newPuzzleId ? "puzzle" : currentSection;
  const hinted = SECTIONS.find(section => section.routeId === sectionHint.hint);

  return (
    <Navbar aria-label="Workspace" maxWidth="full" size="sm" shouldBlockScroll={false}>
      <Navbar.Header>
        <Navbar.MenuToggle className="md:hidden" />
        <Navbar.Brand>
          <Link to="/workspaces" aria-label="All workspaces">
            {/* The team's emoji, if it picked one (Settings › Look). */}
            {workspace.theme.emoji ? (
              <span className="text-lg leading-none">{workspace.theme.emoji}</span>
            ) : (
              <img src="/favicon.ico" alt="" className="size-5 rounded-full" />
            )}
          </Link>
        </Navbar.Brand>
        {/* Real links (⌘/middle-click work) with a segmented look. Sections are icon-only except the
            current one, which also shows its label; the current puzzle always shows its name. */}
        <Tabs selectedKey={selectedKey} className="hidden md:flex">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Workspace sections" className="w-fit">
              {SECTIONS.map(({routeId, path, label, Icon}) => (
                <Tabs.Tab
                  key={routeId}
                  className="w-auto flex-none whitespace-nowrap"
                  id={routeId}
                  href={`/${workspaceSlug}${path}`}
                  aria-label={label}
                  ref={sectionHint.tabRef(routeId)}
                  onHoverChange={hovering => sectionHint.onHoverChange(routeId, hovering)}
                  onPress={sectionHint.hide}>
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
        {/* The icon-only tabs' names (the current one shows its name already). */}
        <Tooltip
          isOpen={Boolean(hinted && sectionHint.anchor && hinted.routeId !== selectedKey)}
          onOpenChange={open => {
            if (!open) sectionHint.dismiss();
          }}>
          <Tooltip.Content placement="bottom" triggerRef={{current: sectionHint.anchor ?? null}}>
            {hinted?.label}
          </Tooltip.Content>
        </Tooltip>
        <Navbar.Spacer />
        <Navbar.Content className="min-w-0">
          {workspace.links.map(link => (
            <Navbar.Item
              key={`${link.name}\n${link.url}`}
              href={link.url}
              // Phones: in the menu instead (they'd crowd out everything else).
              className="text-foreground hidden md:flex">
              <Navbar.Label>{link.name}</Navbar.Label>
              <ExternalLinkIcon data-slot="icon" />
            </Navbar.Item>
          ))}
          <HuntClock />
          <NotificationBell workspaceSlug={workspaceSlug} />
          <LobbyButton />
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
        {workspace.links.map(link => (
          <Navbar.MenuItem key={`${link.name}\n${link.url}`} href={link.url} target="_blank">
            {link.name}
            <ExternalLinkIcon className="size-4" />
          </Navbar.MenuItem>
        ))}
      </Navbar.Menu>
    </Navbar>
  );
}
