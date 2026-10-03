import {useEffect, useRef, useState} from "react";
import type {Observable} from "rxjs";

import type {VoiceParticipant} from "@/server/voice";

import {useVoice} from "./voice-provider";

let audioContext: AudioContext | undefined;

/**
 * Calls `onChange` when the voice on `track` starts or stops (a level threshold with a short
 * hold, so it doesn't flicker between words). Runs locally: nothing is sent anywhere.
 */
export function watchSpeaking(track: MediaStreamTrack, onChange: (speaking: boolean) => void) {
  audioContext ??= new AudioContext();
  // A context created outside a click starts suspended (hearing only silence) until resumed.
  void audioContext.resume();
  const source = audioContext.createMediaStreamSource(new MediaStream([track]));
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let speaking = false;
  let lastLoudAt = 0;
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
    const now = Date.now();
    if (peak > 12) lastLoudAt = now;
    const next = now - lastLoudAt < 400;
    if (next !== speaking) {
      speaking = next;
      onChange(speaking);
    }
  }, 100);
  return () => {
    clearInterval(timer);
    source.disconnect();
    if (speaking) onChange(false);
  };
}

/** Plays a teammate's mic (and screen-share audio) while you're in their room. */
export function RemoteAudio({participant}: {participant: VoiceParticipant}) {
  const {engine} = useVoice();
  const {mic, screenAudio} = participant.tracks;
  const micKey = mic && `${mic.sessionId}/${mic.trackName}`;
  const screenAudioKey =
    participant.screen && screenAudio && `${screenAudio.sessionId}/${screenAudio.trackName}`;

  useEffect(() => {
    if (!engine || !mic) return undefined;
    const playing = engine.play(engine.pull(mic));
    return () => playing.unsubscribe();
    // Re-pull only when the track itself changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, micKey]);

  useEffect(() => {
    if (!engine || !screenAudioKey || !screenAudio) return undefined;
    const playing = engine.play(engine.pull(screenAudio));
    return () => playing.unsubscribe();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, screenAudioKey]);

  return null;
}

/** Shows a video track (a teammate's camera or screen, or your own preview). */
export function Video({
  track$,
  className,
  mirrored = false,
}: {
  track$: Observable<MediaStreamTrack>;
  className?: string;
  mirrored?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hasTrack, setHasTrack] = useState(false);
  useEffect(() => {
    const subscription = track$.subscribe(track => {
      if (ref.current) ref.current.srcObject = new MediaStream([track]);
      setHasTrack(true);
    });
    return () => subscription.unsubscribe();
  }, [track$]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={className}
      style={{transform: mirrored ? "scaleX(-1)" : undefined, opacity: hasTrack ? 1 : 0}}
    />
  );
}
