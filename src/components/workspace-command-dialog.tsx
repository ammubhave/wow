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

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import {useWorkspace} from "./use-workspace";

export function WorkspaceCommandDialog({workspaceId}: {workspaceId: string}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  const workspace = useWorkspace({workspaceId});
  const navigate = useNavigate();
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Workspace">
            <CommandItem
              onSelect={() => {
                void navigate({to: "/$workspaceId", params: {workspaceId}});
                setOpen(false);
              }}>
              <HomeIcon />
              <span>Home</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                void navigate({to: "/$workspaceId/settings", params: {workspaceId}});
                setOpen(false);
              }}>
              <SettingsIcon />
              <span>Settings</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                void navigate({to: "/$workspaceId/activity-log", params: {workspaceId}});
                setOpen(false);
              }}>
              <HistoryIcon />
              <span>Activity Log</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                void navigate({to: "/$workspaceId/help-page", params: {workspaceId}});
                setOpen(false);
              }}>
              <InfoIcon />
              <span>Help</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Puzzles">
            {workspace.rounds.list.data
              .flatMap(round => round.puzzles)
              .map(puzzle => (
                <CommandItem
                  key={puzzle.id}
                  onSelect={() => {
                    void navigate({
                      to: "/$workspaceId/puzzles/$puzzleId",
                      params: {workspaceId, puzzleId: puzzle.id},
                    });
                    setOpen(false);
                  }}>
                  <PuzzleIcon />
                  <span>{puzzle.name}</span>
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Links">
            {(workspace.get.data.links as {name: string; url: string}[] | undefined)?.map(link => (
              <CommandItem
                onSelect={() => {
                  window.open(link.url);
                  setOpen(false);
                }}>
                <LinkIcon />
                <span>{link.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Profile">
            <CommandItem
              onSelect={() => {
                void navigate({to: "/change-password"});
                setOpen(false);
              }}>
              <RotateCcwKeyIcon />
              <span>Change password</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
