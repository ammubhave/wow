import {Command} from "@heroui-pro/react";
import {useNavigate} from "@tanstack/react-router";
import {
  HistoryIcon,
  HomeIcon,
  InfoIcon,
  LinkIcon,
  PuzzleIcon,
  RotateCcwKeyIcon,
  SettingsIcon,
} from "lucide-react";
import {useEffect, useState} from "react";

import {useWorkspace} from "@/hooks/use-workspace";

export function WorkspaceCommandDialog({workspaceSlug}: {workspaceSlug: string}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  const workspace = useWorkspace();
  const navigate = useNavigate();
  return (
    <Command>
      <Command.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Command.Container>
          <Command.Dialog>
            <Command.InputGroup>
              <Command.InputGroup.Input placeholder="Type a command or search..." />
              <Command.InputGroup.ClearButton />
            </Command.InputGroup>
            <Command.List
              renderEmptyState={() => (
                <div className="text-muted flex h-12 items-center justify-center text-sm">
                  No results found.
                </div>
              )}>
              <Command.Group heading="Workspace">
                <Command.Item
                  textValue="Home"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <HomeIcon />
                  <span>Home</span>
                </Command.Item>
                <Command.Item
                  textValue="Settings"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug/settings", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <SettingsIcon />
                  <span>Settings</span>
                </Command.Item>
                <Command.Item
                  textValue="Activity Log"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug/activity-log", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <HistoryIcon />
                  <span>Activity Log</span>
                </Command.Item>
                <Command.Item
                  textValue="Help"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug/help-page", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <InfoIcon />
                  <span>Help</span>
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Puzzles">
                {workspace.rounds
                  .flatMap(round => round.puzzles)
                  .map(puzzle => (
                    <Command.Item
                      key={puzzle.id}
                      textValue={puzzle.name}
                      onAction={() => {
                        void navigate({
                          to: "/$workspaceSlug/puzzles/$puzzleId",
                          params: {workspaceSlug, puzzleId: puzzle.id},
                        });
                        setOpen(false);
                      }}>
                      <PuzzleIcon />
                      <span>{puzzle.name}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
              <Command.Group heading="Links">
                {workspace.links.map(link => (
                  <Command.Item
                    key={`${link.name}\n${link.url}`}
                    textValue={link.name}
                    onAction={() => {
                      window.open(link.url);
                      setOpen(false);
                    }}>
                    <LinkIcon />
                    <span>{link.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Profile">
                <Command.Item
                  textValue="Change password"
                  onAction={() => {
                    void navigate({to: "/change-password"});
                    setOpen(false);
                  }}>
                  <RotateCcwKeyIcon />
                  <span>Change password</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
    </Command>
  );
}
