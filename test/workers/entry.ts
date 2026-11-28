// The Worker the tests run in: every class wrangler.jsonc binds (each must exist), without the
// app's own entry (src/index.ts), which starts TanStack Start.
export {ChatRoom as ChatRoomV2} from "@/server/do/chat";
export {
  DeleteChannelAfterDelayWorkflow,
  DiscordClient as DiscordClientV2,
  DiscordDisconnectWorkflow,
} from "@/server/do/discord-client";
export {NotificationRoom as NotificationRoomV2} from "@/server/do/notification";
export {PresenceRoom as PresenceRoomV2} from "@/server/do/presence";
export {SheetRoom} from "@/server/do/sheet";
export {WhiteboardRoom} from "@/server/do/whiteboard";
export {WorkspaceRoom as WorkspaceRoomV2} from "@/server/do/workspace";
export {DriveAccessWorkflow} from "@/server/drive-access";
export {EmailWorkflow} from "@/server/email";
export {InboundEmailWorkflow} from "@/server/inbound-email";
export {PuzzleCleanupWorkflow} from "@/server/puzzle-cleanup";
export {PuzzleSheetWorkflow} from "@/server/puzzle-worksheet";

export default {fetch: () => new Response("Test worker", {status: 404})} satisfies ExportedHandler;
