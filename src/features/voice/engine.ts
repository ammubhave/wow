// Smooths over cross-browser WebRTC differences (partytracks recommends it).
// oxlint-disable-next-line import/no-unassigned-import -- a polyfill, loaded with this lazy chunk.
import "webrtc-adapter";
import {
  createAudioSink,
  getCamera,
  getMic,
  getScreenshare,
  PartyTracks,
  type TrackMetadata,
} from "partytracks/client";
import {map, Observable, of, type Subscription} from "rxjs";

import type {VoiceTrack} from "@/server/voice";

// Cost and quality: the SFU bills only for data sent out (past a free terabyte a month), so video
// is kept modest. Webcams are small tiles; screen shares need sharp text but few frames.
const CAMERA_ENCODINGS: RTCRtpEncodingParameters[] = [{maxBitrate: 400_000, maxFramerate: 20}];
const SCREEN_ENCODINGS: RTCRtpEncodingParameters[] = [{maxBitrate: 1_500_000, maxFramerate: 10}];

export type TrackKind = "mic" | "camera" | "screenVideo" | "screenAudio";

const toVoiceTrack = (metadata: TrackMetadata): VoiceTrack | undefined =>
  metadata.sessionId && metadata.trackName
    ? {sessionId: metadata.sessionId, trackName: metadata.trackName}
    : undefined;

/**
 * One person's connection to the SFU while in a call: their mic, camera and screen (all pushed up
 * front; muting or turning the camera off swaps in an empty track, so others' subscriptions stay
 * valid), plus pulling teammates' tracks.
 */
export class VoiceEngine {
  readonly partyTracks: PartyTracks;
  // Joining only listens: the mic isn't even opened (no permission prompt) until you unmute.
  readonly mic = getMic({broadcasting: false, activateSource: false});
  readonly camera = getCamera({
    broadcasting: false,
    constraints: {width: {ideal: 640}, height: {ideal: 360}, frameRate: {ideal: 20}},
  });
  readonly screenshare = getScreenshare({
    activateSource: false,
    video: {constraints: {frameRate: {max: 10}}},
  });
  readonly #audioSink: ReturnType<typeof createAudioSink>;
  readonly #subscriptions: Subscription[] = [];

  constructor(workspaceSlug: string, audioElement: HTMLAudioElement) {
    this.partyTracks = new PartyTracks({prefix: `/api/voice/${workspaceSlug}`});
    this.#audioSink = createAudioSink({audioElement});
  }

  /** Publishes all of this person's tracks; `onTrack` receives each one's id for presence. */
  publish(onTrack: (kind: TrackKind, track: VoiceTrack | undefined) => void) {
    const pushes: [TrackKind, Observable<TrackMetadata>][] = [
      ["mic", this.partyTracks.push(this.mic.broadcastTrack$)],
      [
        "camera",
        this.partyTracks.push(this.camera.broadcastTrack$, {sendEncodings$: of(CAMERA_ENCODINGS)}),
      ],
      [
        "screenVideo",
        this.partyTracks.push(this.screenshare.video.broadcastTrack$, {
          sendEncodings$: of(SCREEN_ENCODINGS),
        }),
      ],
      ["screenAudio", this.partyTracks.push(this.screenshare.audio.broadcastTrack$)],
    ];
    for (const [kind, metadata$] of pushes) {
      this.#subscriptions.push(
        metadata$.pipe(map(toVoiceTrack)).subscribe(track => onTrack(kind, track))
      );
    }
  }

  /** A teammate's track (re-pulled automatically if the connection is repaired). */
  pull(track: VoiceTrack) {
    return this.partyTracks.pull(of({location: "remote", ...track}));
  }

  /** Plays a pulled audio track; unsubscribe the result to stop. */
  play(track$: Observable<MediaStreamTrack>) {
    return this.#audioSink.attach(track$);
  }

  /** Hangs up: stops publishing and releases the mic, camera and screen. */
  close() {
    for (const subscription of this.#subscriptions) subscription.unsubscribe();
    this.mic.disableSource();
    this.camera.disableSource();
    this.screenshare.disableSource();
    this.#audioSink.cleanup();
  }
}
