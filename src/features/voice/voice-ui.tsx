import {Avatar, Badge, Button, Chip, Tooltip} from "@heroui/react";
import {useParams} from "@tanstack/react-router";
import {
  HeadphonesIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  PanelBottomCloseIcon,
  PanelBottomOpenIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import {type ReactNode, useMemo, useRef, useState} from "react";
import {share} from "rxjs";
import {cn} from "tailwind-variants";

import {UserHoverCard, userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {useWorkspace, voiceRoomsQueryKey, voiceSpeakingQueryKey} from "@/hooks/use-workspace";
import {VOICE_LOBBY, type VoiceParticipant, type VoiceTrack, type VoiceUser} from "@/server/voice";

import {RemoteAudio, Video} from "./media";
import {usePushed, useVoice} from "./voice-provider";

const NO_ROOMS: Record<string, VoiceParticipant[]> = {};
const NO_SPEAKERS: string[] = [];

function IconButton({
  label,
  onPress,
  children,
  variant = "ghost",
  isActive = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  variant?: "ghost" | "danger";
  isActive?: boolean;
}) {
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          size="sm"
          variant={isActive ? "secondary" : variant}
          aria-label={label}
          aria-pressed={isActive}
          onPress={onPress}>
          {children}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}

function useRoomLabel(room: string | null) {
  const workspace = useWorkspace();
  if (room === null || room === VOICE_LOBBY) return "Lobby";
  for (const round of workspace.rounds) {
    const puzzle = round.puzzles.find(p => p.id === room);
    if (puzzle) return puzzle.name;
  }
  return "Voice";
}

/** Your call controls: mic, camera, screen, and leave. */
function CallControls({room}: {room: string}) {
  const voice = useVoice();
  if (voice.room !== room) {
    // Not in this room: listen in, or jump straight to talking (which moves you here).
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Listen in" onPress={() => void voice.join(room)}>
          <HeadphonesIcon />
        </IconButton>
        <IconButton label="Unmute and talk here" onPress={() => void voice.unmute(room)}>
          <MicOffIcon />
        </IconButton>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton
        label={voice.muted ? "Unmute" : "Mute"}
        onPress={voice.muted ? () => void voice.unmute(room) : voice.mute}
        isActive={!voice.muted}>
        {voice.muted ? <MicOffIcon /> : <MicIcon className="text-success" />}
      </IconButton>
      <IconButton
        label={voice.camera ? "Turn camera off" : "Turn camera on"}
        onPress={voice.toggleCamera}
        isActive={voice.camera}>
        {voice.camera ? <VideoIcon className="text-success" /> : <VideoOffIcon />}
      </IconButton>
      <IconButton
        label={voice.screen ? "Stop sharing" : "Share your screen"}
        onPress={voice.toggleScreen}
        isActive={voice.screen}>
        <MonitorUpIcon className={cn(voice.screen && "text-success")} />
      </IconButton>
      <IconButton label="Leave call" onPress={voice.leave} variant="danger">
        <PhoneOffIcon />
      </IconButton>
    </div>
  );
}

/** A person's chip: ringed while they talk, with their mic/camera/screen state if in the call. */
function PersonChip({
  user,
  call,
  isSpeaking,
  isElsewhere,
}: {
  user: VoiceUser;
  call: VoiceParticipant | undefined;
  isSpeaking: boolean;
  /** In this puzzle's call but not looking at the puzzle. */
  isElsewhere: boolean;
}) {
  const state = call
    ? [
        call.muted ? "muted" : "unmuted",
        call.camera && "camera on",
        call.screen && "sharing screen",
        isSpeaking && "speaking",
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;
  return (
    <UserHoverCard user={user}>
      <Chip
        color={isElsewhere ? "default" : "success"}
        variant="soft"
        size="sm"
        className="cursor-default gap-1 ps-0.5"
        aria-label={state ? `${user.name}: ${state}` : user.name}>
        <Avatar
          size="sm"
          className={cn(
            "size-4 text-[8px] transition-shadow",
            isSpeaking && "ring-success ring-offset-surface ring-2 ring-offset-1"
          )}>
          <Avatar.Image src={userAvatarSrc(user)} alt="" />
          <Avatar.Fallback>{userInitials(user.name)}</Avatar.Fallback>
        </Avatar>
        <Chip.Label>{user.name}</Chip.Label>
        {call &&
          (call.muted ? (
            <MicOffIcon className="text-muted size-3" aria-hidden />
          ) : (
            <MicIcon className={cn("size-3", isSpeaking && "text-success")} aria-hidden />
          ))}
        {call?.camera && <VideoIcon className="size-3" aria-hidden />}
        {call?.screen && <MonitorUpIcon className="size-3" aria-hidden />}
      </Chip>
    </UserHoverCard>
  );
}

/**
 * Above a chat: who's here (looking at the puzzle, or on the board for the team chat) and who's in
 * the call (the puzzle's, or the lobby), with mic, camera, screen and speaking state visible
 * without joining, and your controls for it.
 */
export function PuzzleVoiceStrip({room, viewers}: {room: string; viewers: VoiceUser[]}) {
  const voice = useVoice();
  const participants = voice.rooms[room] ?? [];
  const callByUser = new Map(participants.map(p => [p.user.id, p]));
  const viewerIds = new Set(viewers.map(v => v.id));
  // People in the call who've wandered off to another page still belong here.
  const elsewhere = participants.filter(p => !viewerIds.has(p.user.id));
  const isSpeaking = (call: VoiceParticipant | undefined) =>
    call !== undefined && voice.speaking.has(call.connectionId);
  return (
    <div className="flex items-start gap-2 px-2 py-2">
      <div className="flex max-h-25 min-w-0 flex-1 flex-row flex-wrap gap-0.5 overflow-y-auto">
        {viewers.map(user => {
          const call = callByUser.get(user.id);
          return (
            <PersonChip
              key={user.id}
              user={user}
              call={call}
              isSpeaking={isSpeaking(call)}
              isElsewhere={false}
            />
          );
        })}
        {elsewhere.map(p => (
          <PersonChip
            key={p.connectionId}
            user={p.user}
            call={p}
            isSpeaking={isSpeaking(p)}
            isElsewhere
          />
        ))}
      </div>
      <CallControls room={room} />
    </div>
  );
}

/** The lobby's headphones button (header): join to listen, with a count of who's there. */
export function LobbyButton() {
  const voice = useVoice();
  const participants = voice.rooms[VOICE_LOBBY] ?? [];
  const isHere = voice.room === VOICE_LOBBY;
  const anyoneTalking = participants.some(p => voice.speaking.has(p.connectionId));
  const names = participants.map(p => p.user.name).join(", ");
  const tooltip = isHere
    ? "Leave the lobby"
    : participants.length > 0
      ? `Listen in the lobby · ${names}`
      : "Listen in the lobby";
  return (
    <Badge.Anchor>
      <Tooltip delay={300}>
        <Tooltip.Trigger>
          <Button
            size="sm"
            isIconOnly
            variant={isHere ? "secondary" : "ghost"}
            aria-label={tooltip}
            aria-pressed={isHere}
            onPress={() => (isHere ? voice.leave() : void voice.join(VOICE_LOBBY))}>
            <HeadphonesIcon className={cn((isHere || anyoneTalking) && "text-success")} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>{tooltip}</Tooltip.Content>
      </Tooltip>
      {participants.length > 0 && !isHere && (
        <Badge color="success" size="sm" placement="top-right">
          {participants.length}
        </Badge>
      )}
    </Badge.Anchor>
  );
}

const NO_PARTICIPANTS: VoiceParticipant[] = [];

/**
 * On the board: who's in this puzzle's call (pulsing while someone talks). Reads the cache
 * directly with selectors, so a row re-renders only when its own room changes, not whenever anyone
 * anywhere starts or stops talking.
 */
export function VoiceRoomBadge({room}: {room: string}) {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const participants = usePushed(
    voiceRoomsQueryKey(workspaceSlug),
    NO_ROOMS,
    rooms => rooms[room] ?? NO_PARTICIPANTS
  );
  const anyoneTalking = usePushed(voiceSpeakingQueryKey(workspaceSlug), NO_SPEAKERS, ids =>
    participants.some(p => ids.includes(p.connectionId))
  );
  if (participants.length === 0) return null;
  const names = participants.map(p => p.user.name).join(", ");
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <span
          className={cn(
            "text-success inline-flex shrink-0 items-center gap-0.5",
            anyoneTalking && "animate-pulse"
          )}
          aria-label={`In voice: ${names}`}>
          <HeadphonesIcon className="size-3.5" />
          <span className="text-xs tabular-nums">{participants.length}</span>
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content>In voice: {names}</Tooltip.Content>
    </Tooltip>
  );
}

/** A teammate's camera or screen. Screens can go fullscreen. */
function RemoteVideo({
  track,
  label,
  isScreen,
}: {
  track: VoiceTrack;
  label: string;
  isScreen: boolean;
}) {
  const {engine} = useVoice();
  const containerRef = useRef<HTMLDivElement>(null);
  const track$ = useMemo(
    () => engine!.pull(track).pipe(share()),
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- re-pull only when the track changes.
    [engine, track.sessionId, track.trackName]
  );
  return (
    <div
      ref={containerRef}
      className={cn(
        "group bg-default relative aspect-video overflow-hidden rounded-lg",
        isScreen && "col-span-full"
      )}>
      <Video track$={track$} className="size-full object-contain" />
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {label}
      </span>
      {isScreen && (
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label={`Show ${label} fullscreen`}
          className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100"
          onPress={() => void containerRef.current?.requestFullscreen()}>
          <MaximizeIcon />
        </Button>
      )}
    </div>
  );
}

/**
 * While you're in a call: plays the room, shows cameras and shared screens, and (when you're not
 * looking at the call's puzzle, whose strip has the controls) a floating bar to control it.
 */
export function CallBar() {
  const voice = useVoice();
  const {engine, room, me} = voice;
  const {puzzleId} = useParams({strict: false});
  const label = useRoomLabel(room);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  if (!room || !engine) return null;
  const participants = voice.rooms[room] ?? [];
  const others = participants.filter(p => p.connectionId !== me);
  const videos = others.flatMap(p => [
    ...(p.screen && p.tracks.screenVideo
      ? [{key: `${p.connectionId}-screen`, track: p.tracks.screenVideo, isScreen: true, p}]
      : []),
    ...(p.camera && p.tracks.camera
      ? [{key: `${p.connectionId}-camera`, track: p.tracks.camera, isScreen: false, p}]
      : []),
  ]);
  const hasMedia = videos.length > 0 || voice.camera;
  const showControls = room !== puzzleId;

  return (
    <>
      {others.map(p => (
        <RemoteAudio key={p.connectionId} participant={p} />
      ))}
      <div className="pointer-events-none fixed inset-x-0 bottom-12 z-40 flex flex-col items-center gap-2 px-4">
        {hasMedia && isPanelOpen && (
          <div className="bg-overlay pointer-events-auto grid max-h-[60vh] w-full max-w-2xl grid-cols-2 gap-2 overflow-y-auto rounded-2xl p-2 shadow-lg">
            {videos.map(v => (
              <RemoteVideo
                key={v.key}
                track={v.track}
                isScreen={v.isScreen}
                label={v.isScreen ? `${v.p.user.name}'s screen` : v.p.user.name}
              />
            ))}
            {voice.camera && (
              <div className="bg-default relative aspect-video overflow-hidden rounded-lg">
                <Video
                  track$={engine.camera.broadcastTrack$}
                  className="size-full object-cover"
                  mirrored
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                  You
                </span>
              </div>
            )}
          </div>
        )}
        {voice.talkingWhileMuted && (
          <output className="bg-overlay text-warning pointer-events-auto rounded-full px-3 py-1 text-xs shadow-md">
            You're muted
          </output>
        )}
        {(showControls || hasMedia) && (
          <div className="bg-overlay pointer-events-auto flex items-center gap-2 rounded-full py-1 ps-3 pe-1 shadow-lg">
            <HeadphonesIcon className="text-success size-4 shrink-0" />
            <span className="max-w-40 truncate text-sm font-medium" title={label}>
              {label}
            </span>
            <div className="flex -space-x-1.5">
              {participants.slice(0, 5).map(p => (
                <Avatar
                  key={p.connectionId}
                  size="sm"
                  className={cn(
                    "ring-surface size-6 ring-2 transition-shadow",
                    voice.speaking.has(p.connectionId) && "ring-success"
                  )}>
                  <Avatar.Image src={userAvatarSrc(p.user)} alt={p.user.name} />
                  <Avatar.Fallback>{userInitials(p.user.name)}</Avatar.Fallback>
                </Avatar>
              ))}
              {participants.length > 5 && (
                <span className="text-muted ps-2.5 text-xs tabular-nums">
                  +{participants.length - 5}
                </span>
              )}
            </div>
            {showControls && <CallControls room={room} />}
            {hasMedia && (
              <IconButton
                label={isPanelOpen ? "Hide video" : "Show video"}
                onPress={() => setIsPanelOpen(open => !open)}>
                {isPanelOpen ? <PanelBottomCloseIcon /> : <PanelBottomOpenIcon />}
              </IconButton>
            )}
          </div>
        )}
      </div>
    </>
  );
}
