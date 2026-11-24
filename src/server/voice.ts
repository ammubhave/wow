import {z} from "zod";

/**
 * Voice rooms (Cloudflare Realtime SFU, via partytracks). Media flows between browsers and
 * Cloudflare; this app only tracks who is in which room and which SFU tracks they publish. That
 * presence rides on the workspace's websocket (WorkspaceRoom), so the board can show who's talking
 * where without another connection.
 *
 * A room is a puzzle id, or `VOICE_LOBBY` for the workspace-wide lobby.
 */
export const VOICE_LOBBY = "lobby";

const trackSchema = z.object({sessionId: z.string().max(128), trackName: z.string().max(128)});
export type VoiceTrack = z.infer<typeof trackSchema>;

/** What a client reports about itself (sent over the workspace websocket). */
export const voiceUpdateSchema = z.object({
  type: z.literal("voice"),
  // null: not in a call.
  room: z.string().min(1).max(64).nullable(),
  muted: z.boolean(),
  camera: z.boolean(),
  screen: z.boolean(),
  tracks: z.object({
    mic: trackSchema.optional(),
    camera: trackSchema.optional(),
    screenVideo: trackSchema.optional(),
    screenAudio: trackSchema.optional(),
  }),
});
export type VoiceUpdate = z.infer<typeof voiceUpdateSchema>;

/**
 * Sent by someone unmuted in a call when they start or stop talking (detected in their own
 * browser), so everyone sees who's speaking, whether or not they're listening.
 */
export const speakingUpdateSchema = z.object({type: z.literal("speaking"), speaking: z.boolean()});

export const voiceClientMessageSchema = z.discriminatedUnion("type", [
  voiceUpdateSchema,
  speakingUpdateSchema,
]);

export type VoiceUser = {id: string; name: string; email: string | null; image: string | null};

export type VoiceParticipant = Omit<VoiceUpdate, "type" | "room"> & {
  /** One per browser tab: the same person can be in a call from one tab only, but it's per tab. */
  connectionId: string;
  user: VoiceUser;
};

/** Sent to every client whenever anyone joins, leaves or changes their call state. */
export type VoiceState = {type: "voice"; rooms: Record<string, VoiceParticipant[]>};

/** Someone (by connection) started or stopped talking. */
export type VoiceSpeaking = {type: "speaking"; connectionId: string; speaking: boolean};

/** Sent once per socket: which `connectionId` is this tab. */
export type VoiceHello = {type: "voiceHello"; connectionId: string};

/**
 * Sent to your other tabs/devices when you unmute in one, so you're only ever unmuted in one
 * place.
 */
export type VoiceMute = {type: "voiceMute"};

export type VoiceServerMessage = VoiceState | VoiceSpeaking | VoiceHello | VoiceMute;

/** Who is in a call room, and how many of them share their camera or screen. */
export type VoiceRoomCounts = {people: number; cameras: number; screens: number};

/**
 * Voice usage accounting: each call room's counts since `at`. Kept by the workspace room and closed
 * out whenever anyone joins, leaves or changes their call state.
 */
export type VoiceUsageSample = {at: number; rooms: Record<string, VoiceRoomCounts>};

export type VoiceStreamKind = "audio" | "camera" | "screen";

/**
 * Seconds of media streams the voice service delivered over a period, by kind. Everyone in a room
 * receives every stream the others publish: n people for t seconds is n × (n − 1) × t of audio,
 * and each camera or screen is (n − 1) × t more. This is what the SFU bills (egress).
 */
export type VoiceUsagePeriod = {room: string; kind: VoiceStreamKind; streamSeconds: number};

/** The usage of each call room from `sample.at` until `now` (at the counts of the sample). */
export function voiceUsageSince(
  sample: VoiceUsageSample | undefined,
  now: number
): VoiceUsagePeriod[] {
  if (!sample) return [];
  const seconds = Math.max(0, (now - sample.at) / 1000);
  // Under a second (e.g. two state changes in a row): not worth recording.
  if (seconds < 1) return [];
  return Object.entries(sample.rooms).flatMap(([room, {people, cameras, screens}]) => {
    const receivers = Math.max(0, people - 1);
    const streams: [VoiceStreamKind, number][] = [
      ["audio", people],
      ["camera", cameras],
      ["screen", screens],
    ];
    return streams
      .filter(([, publishers]) => publishers * receivers > 0)
      .map(([kind, publishers]) => ({room, kind, streamSeconds: seconds * publishers * receivers}));
  });
}
