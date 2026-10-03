import {posthog} from "posthog-js";

import {MENTION_PATTERN} from "@/server/notifications";

/**
 * A product event from the browser, for things only the browser sees (chat, voice, whiteboard,
 * notifications). PostHog adds who did it and their workspace group. Properties describe what
 * happened, never content. Changes to puzzles and workspaces are recorded by the server instead
 * (src/server/router/tracking.ts).
 */
export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

/** What a chat message is made of (not what it says). */
export const describeChatMessage = (text: string, imageCount = 0) => ({
  length: text.length,
  mentionCount: [...text.matchAll(MENTION_PATTERN)].length,
  imageCount,
});
