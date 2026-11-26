import {Command} from "@heroui-pro/react";
import {useNavigate} from "@tanstack/react-router";
import {
  CompassIcon,
  HeadphonesIcon,
  MegaphoneIcon,
  PlusIcon,
  BookOpenIcon,
  HistoryIcon,
  TableIcon,
  InfoIcon,
  LinkIcon,
  PuzzleIcon,
  UserCogIcon,
  SettingsIcon,
  TrophyIcon,
} from "lucide-react";
import {useEffect, useState} from "react";

import {AddNewMetaPuzzleDialog} from "@/components/add-new-meta-puzzle-dialog";
import {AddNewPuzzleDialog} from "@/components/add-new-puzzle-dialog";
import {AddNewRoundDialog} from "@/components/add-new-round-dialog";
import {MakeAccouncementDialog} from "@/components/make-announcement-dialog";
import {DOC_PAGES} from "@/docs/registry";
import {useTour} from "@/features/tour/tour-provider";
import {useVoice} from "@/features/voice/voice-provider";
import {useIsReadOnly} from "@/hooks/use-is-read-only";
import {useWorkspace} from "@/hooks/use-workspace";
import {VOICE_LOBBY} from "@/server/voice";

/** Every word typed appears somewhere, in any order ("feeder keeper" finds "Add a feeder to Keeper's Log"). */
const matchesEveryWord = (textValue: string, inputValue: string) => {
  const text = textValue.toLowerCase();
  return inputValue
    .toLowerCase()
    .split(/\s+/)
    .every(word => text.includes(word));
};

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
  // A read-only (archived) workspace only offers the actions that change nothing.
  const isReadOnly = useIsReadOnly();
  const navigate = useNavigate();
  const tour = useTour();
  const voice = useVoice();
  // What an action opened (the palette closes; the dialog takes over).
  const [dialog, setDialog] = useState<
    | {type: "round"}
    | {type: "meta"; roundId: string}
    | {type: "puzzle"; roundId: string; parentPuzzleId?: string}
    | {type: "announce"}
    | null
  >(null);
  const run = (action: () => void) => {
    action();
    setOpen(false);
  };
  const inLobby = voice.room === VOICE_LOBBY;
  // Keyboard-only, like Spotlight: ⌘K / Ctrl+K opens it; there's deliberately no visible trigger.
  return (
    <Command>
      <Command.Backdrop isOpen={open} onOpenChange={setOpen}>
        <Command.Container>
          <Command.Dialog filter={matchesEveryWord}>
            <Command.InputGroup>
              <Command.InputGroup.Input placeholder="Type a command or search..." />
              <Command.InputGroup.ClearButton />
            </Command.InputGroup>
            <Command.List
              renderEmptyState={() => (
                <div className="text-muted flex h-12 items-center justify-center text-sm">
                  No results. Maybe it was a red herring?
                </div>
              )}>
              {/* Things to do, not just places to go. Searchable: "add tide", "feeder keeper". */}
              <Command.Group heading="Actions">
                {!isReadOnly && (
                  <Command.Item
                    textValue="Add round new"
                    onAction={() => run(() => setDialog({type: "round"}))}>
                    <PlusIcon />
                    <span>Add round</span>
                  </Command.Item>
                )}
                {!isReadOnly && (
                  <Command.Item
                    textValue="Make an announcement announce megaphone"
                    onAction={() => run(() => setDialog({type: "announce"}))}>
                    <MegaphoneIcon />
                    <span>Make an announcement</span>
                  </Command.Item>
                )}
                <Command.Item
                  textValue={
                    inLobby ? "Leave the lobby call voice" : "Join the lobby call voice listen"
                  }
                  onAction={() =>
                    run(() => (inLobby ? voice.leave() : void voice.join(VOICE_LOBBY)))
                  }>
                  <HeadphonesIcon />
                  <span>{inLobby ? "Leave the lobby call" : "Join the lobby call"}</span>
                </Command.Item>
                {!isReadOnly &&
                  workspace.rounds.map(round => (
                    <Command.Item
                      key={`meta-${round.id}`}
                      textValue={`Add a meta in ${round.name}`}
                      onAction={() => run(() => setDialog({type: "meta", roundId: round.id}))}>
                      <PlusIcon />
                      <span>
                        Add a meta in <strong>{round.name}</strong>
                      </span>
                    </Command.Item>
                  ))}
                {!isReadOnly &&
                  workspace.rounds.map(round => (
                    <Command.Item
                      key={`puzzle-${round.id}`}
                      textValue={`Add a puzzle in ${round.name}`}
                      onAction={() => run(() => setDialog({type: "puzzle", roundId: round.id}))}>
                      <PlusIcon />
                      <span>
                        Add a puzzle in <strong>{round.name}</strong>
                      </span>
                    </Command.Item>
                  ))}
                {!isReadOnly &&
                  workspace.rounds.flatMap(round =>
                    round.metaPuzzles.map(meta => (
                      <Command.Item
                        key={`feeder-${meta.id}`}
                        textValue={`Add a feeder to ${meta.name}`}
                        onAction={() =>
                          run(() =>
                            setDialog({type: "puzzle", roundId: round.id, parentPuzzleId: meta.id})
                          )
                        }>
                        <PlusIcon />
                        <span>
                          Add a feeder to <strong>{meta.name}</strong>
                        </span>
                      </Command.Item>
                    ))
                  )}
              </Command.Group>
              <Command.Group heading="Workspace">
                <Command.Item
                  textValue="Blackboard home board"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <TableIcon />
                  <span>Blackboard</span>
                </Command.Item>
                <Command.Item
                  textValue="Leaderboard recap standings awards"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug/recap", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <TrophyIcon />
                  <span>Leaderboard</span>
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
                  textValue="Activity log"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug/activity-log", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <HistoryIcon />
                  <span>Activity log</span>
                </Command.Item>
                <Command.Item
                  textValue="Help"
                  onAction={() => {
                    void navigate({to: "/$workspaceSlug/help", params: {workspaceSlug}});
                    setOpen(false);
                  }}>
                  <InfoIcon />
                  <span>Help</span>
                </Command.Item>
                {tour && (
                  <Command.Item
                    textValue="Take the tour"
                    onAction={() => {
                      tour.start();
                      setOpen(false);
                    }}>
                    <CompassIcon />
                    <span>Take the tour</span>
                  </Command.Item>
                )}
              </Command.Group>
              {/* Every docs page, opened in the workspace's Help tab. */}
              <Command.Group heading="Help and docs">
                {DOC_PAGES.filter(page => page.slug).map(page => (
                  <Command.Item
                    key={page.slug}
                    textValue={`${page.title} ${page.section}`}
                    onAction={() => {
                      void navigate({
                        to: "/$workspaceSlug/help/$",
                        params: {workspaceSlug, _splat: page.slug},
                      });
                      setOpen(false);
                    }}>
                    <BookOpenIcon />
                    <span>{page.title}</span>
                  </Command.Item>
                ))}
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
              <Command.Group heading="Account">
                <Command.Item
                  textValue="Account settings, change password, passkeys, sessions"
                  onAction={() => {
                    void navigate({to: "/profile"});
                    setOpen(false);
                  }}>
                  <UserCogIcon />
                  <span>Account settings</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command.Dialog>
        </Command.Container>
      </Command.Backdrop>
      {/* Mounted only while open, like the board's own dialogs. */}
      {dialog?.type === "round" && (
        <AddNewRoundDialog
          workspaceSlug={workspaceSlug}
          open
          setOpen={isOpen => !isOpen && setDialog(null)}
        />
      )}
      {dialog?.type === "meta" && (
        <AddNewMetaPuzzleDialog
          workspaceSlug={workspaceSlug}
          roundId={dialog.roundId}
          open
          setOpen={isOpen => !isOpen && setDialog(null)}
        />
      )}
      {dialog?.type === "puzzle" && (
        <AddNewPuzzleDialog
          workspaceSlug={workspaceSlug}
          roundId={dialog.roundId}
          parentPuzzleId={dialog.parentPuzzleId}
          open
          setOpen={isOpen => !isOpen && setDialog(null)}
        />
      )}
      {dialog?.type === "announce" && (
        <MakeAccouncementDialog
          workspaceSlug={workspaceSlug}
          open
          onOpenChange={isOpen => !isOpen && setDialog(null)}
        />
      )}
    </Command>
  );
}
