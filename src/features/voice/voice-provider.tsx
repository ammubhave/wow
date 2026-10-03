import {useQuery} from "@tanstack/react-query";
import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {ReadyState} from "react-use-websocket/dist/lib/constants";
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import {toast} from "sonner";

import {voiceMeQueryKey, voiceRoomsQueryKey, voiceSpeakingQueryKey} from "@/hooks/use-workspace";
import {track as trackEvent} from "@/lib/analytics";
import {
  VOICE_LOBBY,
  type VoiceParticipant,
  type VoiceTrack,
  type VoiceUpdate,
} from "@/server/voice";

import type {TrackKind, VoiceEngine} from "./engine";
import {watchSpeaking} from "./media";

type Tracks = VoiceUpdate["tracks"];

type VoiceContextValue = {
  /** Who's in which room, for everyone in the workspace. */
  rooms: Record<string, VoiceParticipant[]>;
  /** Connection ids of whoever is talking right now (anywhere in the workspace). */
  speaking: ReadonlySet<string>;
  /** This tab's connection id (to find yourself among a room's participants). */
  me: string | undefined;
  /** The room this tab is in (listening to), if any. */
  room: string | null;
  engine: VoiceEngine | null;
  muted: boolean;
  camera: boolean;
  screen: boolean;
  /** You're talking while muted (for a nudge). Detected locally; nothing is sent. */
  talkingWhileMuted: boolean;
  /** Listens in `room` (muted): moves you there from any other room. */
  join: (room: string) => Promise<VoiceEngine>;
  leave: () => void;
  /** Unmutes, joining `room` first if you're not in it (which mutes you anywhere else). */
  unmute: (room: string) => Promise<void>;
  mute: () => void;
  toggleCamera: () => void;
  toggleScreen: () => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

const NO_ROOMS: Record<string, VoiceParticipant[]> = {};
const NO_SPEAKERS: string[] = [];

/**
 * Reads voice state the workspace socket keeps in the query cache (see WorkspaceProvider). With
 * `select`, re-renders only when the selected part changes.
 */
export function usePushed<T, S = T>(
  queryKey: readonly unknown[],
  fallback: T,
  select?: (data: T) => S
): S {
  const selected = useQuery<T, Error, S>({
    queryKey,
    queryFn: () => fallback,
    staleTime: Infinity,
    enabled: false,
    select,
  }).data;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- without `select`, S is T.
  return selected ?? (select ? select(fallback) : (fallback as unknown as S));
}

/** Loads the media engine (its code is a separate chunk) and starts publishing. */
async function createEngine(
  workspaceSlug: string,
  audioElement: HTMLAudioElement,
  onTrack: (kind: TrackKind, track: VoiceTrack | undefined) => void
) {
  const {VoiceEngine} = await import("./engine");
  const engine = new VoiceEngine(workspaceSlug, audioElement);
  engine.publish(onTrack);
  return engine;
}

/**
 * Voice calls for the workspace. Lives in the workspace layout, so you stay in a call while moving
 * around; joining another room moves you (always muted). Presence and who's speaking go over the
 * shared workspace socket, so everyone sees them without joining; media goes through the SFU.
 */
export function VoiceProvider({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const rooms = usePushed(voiceRoomsQueryKey(workspaceSlug), NO_ROOMS);
  const speakingIds = usePushed(voiceSpeakingQueryKey(workspaceSlug), NO_SPEAKERS);
  const me = usePushed<string | undefined>(voiceMeQueryKey(workspaceSlug), undefined);
  const speaking = useMemo(() => new Set(speakingIds), [speakingIds]);
  const {sendJsonMessage, readyState} = useWebSocket(`/api/workspaces/${workspaceSlug}`, {
    share: true,
    shouldReconnect: () => true,
    filter: () => false,
    onMessage: event => {
      // You unmuted in another tab or on another device: mute here.
      const message: {type?: unknown} = JSON.parse(event.data);
      if (message.type === "voiceMute") engineRef.current?.mic.stopBroadcasting();
    },
  });

  const [room, setRoomState] = useState<string | null>(null);
  // Mirrors `room` synchronously, for handlers that run before a re-render (double clicks).
  const roomRef = useRef<string | null>(null);
  const [engine, setEngine] = useState<VoiceEngine | null>(null);
  const [muted, setMuted] = useState(true);
  const [camera, setCamera] = useState(false);
  const [screen, setScreen] = useState(false);
  const [tracks, setTracks] = useState<Tracks>({});
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const engineRef = useRef<VoiceEngine | null>(null);
  // The engine being created (its code loads lazily), so a double-click doesn't make two.
  const creatingRef = useRef<Promise<VoiceEngine> | null>(null);

  // Tell the room our state whenever it changes, and again after the socket reconnects (the
  // server forgets a closed socket's call).
  useEffect(() => {
    if (readyState !== ReadyState.OPEN) return;
    const update: VoiceUpdate = {type: "voice", room, muted, camera, screen, tracks};
    sendJsonMessage(update);
  }, [readyState, room, muted, camera, screen, tracks, sendJsonMessage]);

  // Mirror the engine's device state (e.g. screen sharing stopped from the browser's own bar).
  useEffect(() => {
    if (!engine) return undefined;
    const subscriptions = [
      engine.mic.isBroadcasting$.subscribe(on => setMuted(!on)),
      engine.camera.isBroadcasting$.subscribe(setCamera),
      engine.screenshare.isBroadcasting$.subscribe(setScreen),
      engine.mic.error$.subscribe(() =>
        toast.error("Couldn't use your microphone. Check the browser's permission for this site.")
      ),
      engine.camera.error$.subscribe(() => toast.error("Couldn't use your camera.")),
      engine.screenshare.video.error$.subscribe(error => {
        // Cancelling the browser's screen picker isn't an error worth reporting.
        if (error.name !== "NotAllowedError") toast.error("Couldn't share your screen.");
      }),
    ];
    return () => subscriptions.forEach(subscription => subscription.unsubscribe());
  }, [engine]);

  // Whether you're talking, from your own mic (once you've unmuted at least once).
  useEffect(() => {
    if (!engine) return undefined;
    let stop: (() => void) | undefined;
    const subscription = engine.mic.localMonitorTrack$.subscribe(track => {
      stop?.();
      stop = watchSpeaking(track, setSelfSpeaking);
    });
    return () => {
      subscription.unsubscribe();
      stop?.();
      setSelfSpeaking(false);
    };
  }, [engine]);

  // Everyone sees who's talking, so share it, but only while unmuted.
  const isTalking = selfSpeaking && !muted && room !== null;
  useEffect(() => {
    if (readyState !== ReadyState.OPEN || room === null) return;
    sendJsonMessage({type: "speaking", speaking: isTalking});
  }, [isTalking, readyState, room, sendJsonMessage]);

  const leave = useCallback(() => {
    if (roomRef.current !== null) trackEvent("voice_left");
    engine?.close();
    engineRef.current = null;
    setEngine(null);
    roomRef.current = null;
    setRoomState(null);
    setTracks({});
    setMuted(true);
  }, [engine]);

  const join = useCallback(
    async (next: string): Promise<VoiceEngine> => {
      // The ref, not state: a second click right after the engine was created must reuse it.
      const existing = engineRef.current;
      if (existing && next === roomRef.current) return existing;
      trackEvent("voice_joined", {
        room: next === VOICE_LOBBY ? "lobby" : "puzzle",
        moved: Boolean(existing),
      });
      if (existing) {
        // Moving rooms: you arrive muted, with camera and screen off.
        existing.mic.stopBroadcasting();
        existing.camera.stopBroadcasting();
        existing.screenshare.stopBroadcasting();
        roomRef.current = next;
        setRoomState(next);
        return existing;
      }
      creatingRef.current ??= createEngine(workspaceSlug, audioRef.current!, (kind, track) =>
        setTracks(current => ({...current, [kind]: track}))
      )
        .then(created => {
          engineRef.current = created;
          setEngine(created);
          return created;
        })
        .finally(() => {
          creatingRef.current = null;
        });
      const created = await creatingRef.current;
      roomRef.current = next;
      setRoomState(next);
      return created;
    },
    // oxlint-disable-next-line react/memo-dependencies -- false positive: used in createEngine().
    [workspaceSlug]
  );

  // Joining another room first mutes you in the old one, so you're only ever unmuted in one.
  const unmute = useCallback(
    async (target: string) => {
      const joined = await join(target);
      joined.mic.startBroadcasting();
      trackEvent("voice_unmuted", {room: target === VOICE_LOBBY ? "lobby" : "puzzle"});
    },
    [join]
  );

  // Hang up when leaving the workspace.
  useEffect(() => () => engineRef.current?.close(), []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      rooms,
      speaking,
      me,
      room,
      engine,
      muted,
      camera,
      screen,
      talkingWhileMuted: muted && selfSpeaking,
      join,
      leave,
      unmute,
      mute: () => engine?.mic.stopBroadcasting(),
      toggleCamera: () => {
        if (!camera) trackEvent("voice_camera_started");
        engine?.camera.toggleBroadcasting();
      },
      toggleScreen: () => {
        if (!screen) trackEvent("voice_screen_share_started");
        engine?.screenshare.toggleBroadcasting();
      },
    }),
    [rooms, speaking, me, room, engine, muted, camera, screen, selfSpeaking, join, leave, unmute]
  );

  return (
    <VoiceContext.Provider value={value}>
      {children}
      {/* Teammates' voices play through this (partytracks' audio sink). */}
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- live call audio has no captions. */}
      <audio ref={audioRef} autoPlay hidden />
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const voice = useContext(VoiceContext);
  if (!voice) throw new Error("useVoice must be used within a VoiceProvider");
  return voice;
}
