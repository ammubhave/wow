import handler from "@tanstack/react-start/server-entry";

import {syncHuntListings} from "./server/hunt-calendar";
import {receiveEmail} from "./server/inbound-email";
import {captureServerException} from "./server/posthog";
import {retryPendingPuzzleCleanups} from "./server/puzzle-cleanup";
import {costUsage} from "./server/usage-cost";
import {importUsage} from "./server/usage-import";

/**
 * Dotfile paths (`/.env`, `/.git/config`, `/.aws/credentials`, ...): only vulnerability scanners ask
 * for these, hundreds at a time. The app has none, so answer 404 before it runs: otherwise each one
 * checks the session, redirects to /login and renders the app shell for a client that hangs up
 * mid-stream (Cloudflare then logs "Network connection lost." and cross-request promise warnings).
 * `/.well-known/` stays open for standard discovery files.
 */
const isScannerProbe = (pathname: string) =>
  pathname.startsWith("/.") && !pathname.startsWith("/.well-known/");

export default {
  async fetch(request) {
    if (isScannerProbe(new URL(request.url).pathname)) {
      return new Response("Not found", {status: 404});
    }
    try {
      const response = await handler.fetch(request);
      // Websocket routes catch their own errors (webSocketRoute), so a 500 here was thrown by the
      // framework after the route returned: say so, since its own log line drops the cause.
      if (
        response.status === 500 &&
        request.headers.get("Upgrade")?.toLowerCase() === "websocket"
      ) {
        console.warn(
          `WebSocket ${new URL(request.url).pathname}: 500 after the route returned` +
            ` (client disconnected: ${request.signal.aborted})`
        );
      }
      return response;
    } catch (error) {
      captureServerException(error, {properties: {path: new URL(request.url).pathname}});
      throw error;
    }
  },

  // Cron trigger (wrangler.jsonc), hourly: import the last hour's usage, work out what
  // each workspace cost (src/server/usage-cost.ts), restart unfinished puzzle
  // cleanups (src/server/puzzle-cleanup.ts), and every 6 hours refresh
  // the hunt listings.
  scheduled(controller, _env, ctx) {
    const task = (name: string, run: () => Promise<unknown>) =>
      ctx.waitUntil(
        run().catch((error: unknown) => {
          console.error(`${name} failed:`, error);
          captureServerException(error, {properties: {task: name}});
          throw error;
        })
      );
    task("usage import", () => importUsage());
    task("usage cost", () => costUsage());
    task("puzzle cleanup retry", () => retryPendingPuzzleCleanups());
    if (new Date(controller.scheduledTime).getUTCHours() % 6 === 0) {
      task("hunt listings sync", () => syncHuntListings());
    }
  },

  // Email to a workspace's contact address, <slug>@wafflehaus.io (src/server/inbound-email.ts).
  async email(message) {
    try {
      await receiveEmail(message);
    } catch (error) {
      captureServerException(error, {properties: {task: "inbound email"}});
      throw error;
    }
  },
} satisfies ExportedHandler;

export {DiscordClient} from "./server/do/discord-client";
export {ChatRoom} from "./server/do/chat";
export {NotificationRoom} from "./server/do/notification";
export {PresenceRoom} from "./server/do/presence";
export {
  DeleteChannelAfterDelayWorkflow,
  DiscordDisconnectWorkflow,
} from "./server/do/discord-client";
export {WorkspaceRoom} from "./server/do/workspace";
export {WhiteboardRoom} from "./server/do/whiteboard";
export {SheetRoom} from "./server/do/sheet";
export {PuzzleCleanupWorkflow} from "./server/puzzle-cleanup";
export {DriveAccessWorkflow} from "./server/drive-access";
export {EmailWorkflow} from "./server/email";
export {PuzzleSheetWorkflow} from "./server/puzzle-worksheet";
export {InboundEmailWorkflow} from "./server/inbound-email";
