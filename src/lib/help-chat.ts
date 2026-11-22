import {posthog} from "posthog-js";
import {toast} from "sonner";

import {track} from "./analytics";

/** Where someone opened the help chat from, so we can see which entry points get used. */
export type HelpChatPlace = "account_menu" | "footer";

/**
 * Opens PostHog Support's chat (the same panel as its floating button): bugs, ideas and questions
 * all go there, and the team answers from PostHog's Support inbox.
 */
export function openHelpChat(place: HelpChatPlace) {
  track("help_chat_opened", {place});
  if (posthog.conversations.isAvailable()) {
    posthog.conversations.open();
  } else {
    // Support turned off in PostHog, or PostHog blocked in this browser.
    toast.error("The help chat didn't load. Try turning off your ad blocker for this site.");
  }
}
