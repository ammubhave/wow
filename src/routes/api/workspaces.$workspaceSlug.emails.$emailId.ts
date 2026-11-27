import {createFileRoute} from "@tanstack/react-router";
import {env} from "cloudflare:workers";
import {and, eq} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {authorizeWorkspaceRequest} from "@/server/workspace-access";

/**
 * An email sent to the workspace's contact address, exactly as it arrived (an .eml file, which
 * mail apps open, attachments and all). Members only.
 */
export const Route = createFileRoute("/api/workspaces/$workspaceSlug/emails/$emailId")({
  server: {
    handlers: {
      GET: async ({request, params: {workspaceSlug, emailId}}) => {
        const authz = await authorizeWorkspaceRequest(request, workspaceSlug);
        if (authz.response) return authz.response;
        const email = await db
          .select({rawKey: schema.workspaceEmail.rawKey, subject: schema.workspaceEmail.subject})
          .from(schema.workspaceEmail)
          .where(
            and(
              eq(schema.workspaceEmail.id, emailId),
              eq(schema.workspaceEmail.workspaceId, authz.workspace.id)
            )
          )
          .get();
        const object = email && (await env.R2.get(email.rawKey));
        if (!object) return new Response(null, {status: 404});
        // A file name from the subject, keeping only characters every system accepts.
        const name =
          (email.subject ?? "email")
            .replace(/[^\w .-]+/g, "")
            .trim()
            .slice(0, 80) || "email";
        return new Response(object.body, {
          headers: {
            "Content-Type": "message/rfc822",
            "Content-Disposition": `attachment; filename="${name}.eml"`,
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
