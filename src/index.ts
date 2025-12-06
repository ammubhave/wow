import handler from "@tanstack/react-start/server-entry";

export default {
  fetch(request) {
    return handler.fetch(request);
  },
} satisfies ExportedHandler;

export {DiscordClient} from "./server/do/discord-client";
export {ChatRoom} from "./server/do/chat";
export {NotificationRoom} from "./server/do/notification";
export {PresenceRoom} from "./server/do/presence";
export {DeleteChannelAfterDelayWorkflow} from "./server/do/discord-client";
