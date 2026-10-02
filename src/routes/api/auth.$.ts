import {createFileRoute} from "@tanstack/react-router";

import {auth} from "@/lib/auth";

// better-auth's organization endpoints only check its own roles, which don't match the
// workspace's (owner/member; see workspace-access.ts). Browsers may call just the ones the app
// uses; everything else (updating or deleting a workspace, changing roles, members, invitations)
// goes through our own API, which checks the caller's workspace role.
const ALLOWED_ORGANIZATION_ENDPOINTS = new Set([
  "/api/auth/organization/create",
  "/api/auth/organization/check-slug",
  "/api/auth/organization/list",
  "/api/auth/organization/set-active",
]);

function handle(request: Request) {
  const {pathname} = new URL(request.url);
  if (
    pathname.startsWith("/api/auth/organization/") &&
    !ALLOWED_ORGANIZATION_ENDPOINTS.has(pathname)
  ) {
    return new Response(null, {status: 404});
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {handlers: {GET: ({request}) => handle(request), POST: ({request}) => handle(request)}},
});
