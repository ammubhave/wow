import {createFileRoute} from "@tanstack/react-router";
import {routePartyTracksRequest} from "partytracks/server";
import {z} from "zod";

import {getWorkspaceRoom} from "@/server/do/workspace";
import {authorizeWorkspaceRequest} from "@/server/workspace-access";

// What partytracks sends to add tracks to a session; "remote" ones are pulls of someone else's.
const newTracksSchema = z.object({
  tracks: z.array(
    z.object({
      location: z.string().optional(),
      sessionId: z.string().optional(),
      trackName: z.string().optional(),
    })
  ),
});

/** An error in the shape partytracks reads from the SFU API (it retries pulls on errors). */
const sfuError = (status: number, errorCode: string, errorDescription: string) =>
  Response.json({errorCode, errorDescription}, {status});

// Proxies a workspace member's WebRTC signaling to Cloudflare's Realtime SFU (partytracks), adding
// the app's credentials so they never reach the browser. Media itself flows between the browser
// and Cloudflare, never through here.
//
// The SFU has no permissions of its own, so this is where access is enforced, with the workspace
// room as the authority (it knows who's in which call):
// - new sessions are rate limited per person, and recorded as theirs, so presence can't claim
//   someone else's tracks;
// - pulling a track requires being visibly in the same room as whoever published it.
async function handle(request: Request, workspaceSlug: string) {
  const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
  if (authz.response) return authz.response;
  const appId = process.env.SFU_APP_ID;
  const token = process.env.SFU_APP_TOKEN;
  if (!appId || !token) return new Response("Voice isn't set up on this server", {status: 503});

  const prefix = `/api/voice/${workspaceSlug}`;
  const path = new URL(request.url).pathname.slice(prefix.length);
  const room = getWorkspaceRoom(authz.workspace.id);
  const userId = authz.session.user.id;
  const forward = () =>
    routePartyTracksRequest({
      appId,
      token,
      // Optional: a TURN relay for people on networks that block WebRTC's UDP.
      turnServerAppId: process.env.TURN_SERVER_APP_ID,
      turnServerAppToken: process.env.TURN_SERVER_APP_TOKEN,
      prefix,
      // Only the browser that created an SFU session may change it (a signed, HttpOnly cookie).
      lockSessionToInitiator: true,
      request,
    });

  if (path === "/sessions/new") {
    if (!(await room.allowVoiceSession(userId))) {
      return sfuError(429, "rate_limited", "Too many voice connections. Try again in a minute.");
    }
    const response = await forward();
    if (response.ok) {
      const {sessionId}: {sessionId?: unknown} = await response.clone().json();
      if (typeof sessionId !== "string") {
        return sfuError(502, "bad_gateway", "Couldn't start a voice session.");
      }
      // Recorded before the browser learns the id, so its presence update can be checked.
      await room.registerVoiceSession(sessionId, userId);
    }
    return response;
  }

  if (request.method === "POST" && /^\/sessions\/[^/]+\/tracks\/new$/.test(path)) {
    const body = newTracksSchema.safeParse(
      await request
        .clone()
        .json()
        .catch(() => null)
    );
    if (!body.success) return sfuError(400, "bad_request", "Malformed track request.");
    const pulls = body.data.tracks.filter(track => track.location === "remote");
    if (pulls.length > 0) {
      const wanted = pulls.flatMap(({sessionId, trackName}) =>
        sessionId && trackName ? [{sessionId, trackName}] : []
      );
      const allowed =
        wanted.length === pulls.length && (await room.canPullVoiceTracks(userId, wanted));
      if (!allowed) {
        // Also hit briefly when joining (the pull can beat the room hearing you joined);
        // partytracks retries with backoff.
        return sfuError(403, "forbidden", "Join the call to hear it.");
      }
    }
  }

  return await forward();
}

export const Route = createFileRoute("/api/voice/$workspaceSlug/$")({
  server: {
    handlers: {
      GET: ({request, params: {workspaceSlug}}) => handle(request, workspaceSlug),
      POST: ({request, params: {workspaceSlug}}) => handle(request, workspaceSlug),
      PUT: ({request, params: {workspaceSlug}}) => handle(request, workspaceSlug),
    },
  },
});
