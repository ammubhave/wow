import {env, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep} from "cloudflare:workers";
import {and, eq} from "drizzle-orm";

import {db} from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  DRIVE_DISCONNECTED_DETAIL,
  shareDriveFolder,
  unshareDriveFolder,
} from "@/server/drive-share";
import {GoogleService} from "@/server/router/services/google";

/**
 * Keeps a person's access to a workspace's Google Drive folder in line with their membership:
 * shared when they join, taken away when they leave, are removed or delete their account. Each
 * of those starts this workflow (`startDriveAccess`), which retries Google's passing failures
 * (rate limits, errors on its side) and tells the owners only once it has really failed.
 *
 * It doesn't take an action, it makes the folder match whether they're a member now, and checks
 * again afterwards: someone who joins and leaves at once ends up without access, whichever of the
 * two workflows runs last.
 */
export type DriveAccessParams = {
  workspaceId: string;
  userId: string;
  /** Who to share with or remove: given, since a deleted account's row is gone by then. */
  name: string;
  email: string;
};

type Access = "share" | "unshare";
type Outcome = {ok: true} | {ok: false; detail: string; blockingFileId?: string};

/** Membership can change while a run is under way; past this many passes, the next run settles it. */
const MAX_PASSES = 3;

export class DriveAccessWorkflow extends WorkflowEntrypoint<Env, DriveAccessParams> {
  async run(event: WorkflowEvent<DriveAccessParams>, step: WorkflowStep) {
    const {workspaceId, userId, email} = event.payload;
    let last: {access: Access; folderId: string; outcome: Outcome} | null = null;
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      // oxlint-disable-next-line no-await-in-loop -- each pass depends on the one before.
      const before = await step.do(`check membership ${pass}`, () =>
        readState(workspaceId, userId)
      );
      // No folder (Drive not set up), or no workspace any more: nothing to share or take away.
      if (!before.folderId) return;
      const access: Access = before.member ? "share" : "unshare";
      const folderId = before.folderId;
      let outcome: Outcome;
      try {
        // oxlint-disable-next-line no-await-in-loop -- as above.
        outcome = await step.do(
          `${access} ${pass}`,
          {retries: {limit: 6, delay: "30 seconds", backoff: "exponential"}, timeout: "2 minutes"},
          () => applyAccess(workspaceId, folderId, email, access)
        );
      } catch (error) {
        // Google kept failing through every retry.
        const reason = error instanceof Error ? error.message : String(error);
        outcome = {ok: false, detail: `Google Drive kept failing: ${reason}`};
      }
      last = {access, folderId, outcome};
      // oxlint-disable-next-line no-await-in-loop -- as above.
      const after = await step.do(`check membership again ${pass}`, () =>
        readState(workspaceId, userId)
      );
      if (after.member === before.member) break;
    }
    if (last && !last.outcome.ok) {
      const {access, folderId, outcome} = last;
      await step.do("tell the owners", () => tellOwners(event.payload, access, folderId, outcome));
    }
  }
}

/** Whether they're a member now, and the workspace's Drive folder (null if none). */
async function readState(workspaceId: string, userId: string) {
  const [workspace, member] = await Promise.all([
    db
      .select({folderId: schema.organization.googleFolderId})
      .from(schema.organization)
      .where(eq(schema.organization.id, workspaceId))
      .get(),
    db
      .select({id: schema.member.id})
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, workspaceId), eq(schema.member.userId, userId)))
      .get(),
  ]);
  return {member: member !== undefined, folderId: workspace?.folderId ?? null};
}

/**
 * Shares the folder with them or takes their access away. Throws (so the step is retried) when
 * Google might succeed later; anything else is the outcome, to tell the owners about.
 */
async function applyAccess(
  workspaceId: string,
  folderId: string,
  email: string,
  access: Access
): Promise<Outcome> {
  const token = await new GoogleService().getAccessToken(workspaceId).catch(() => null);
  if (!token) return {ok: false, detail: DRIVE_DISCONNECTED_DETAIL};
  const result =
    access === "share"
      ? await shareDriveFolder(token, folderId, email)
      : await unshareDriveFolder(token, folderId, email);
  if (result.ok) return {ok: true};
  if (result.retryable) throw new Error(result.detail);
  return {
    ok: false,
    detail: result.detail,
    ...("blockingFileId" in result && result.blockingFileId
      ? {blockingFileId: result.blockingFileId}
      : {}),
  };
}

/** The owners can change the folder's sharing by hand: tell them what went wrong. */
async function tellOwners(
  {workspaceId, userId, name, email}: DriveAccessParams,
  access: Access,
  folderId: string,
  outcome: Extract<Outcome, {ok: false}>
) {
  const owners = await db
    .select({id: schema.member.userId})
    .from(schema.member)
    .where(and(eq(schema.member.organizationId, workspaceId), eq(schema.member.role, "owner")))
    .all();
  if (owners.length === 0) return;
  await env.NOTIFICATION_ROOMS.getByName(workspaceId, {locationHint: "enam"}).broadcast(
    workspaceId,
    {
      type: "driveShareFailed",
      access,
      toUserIds: owners.map(owner => owner.id),
      member: {id: userId, name, email},
      folderId,
      detail: outcome.detail,
      ...(outcome.blockingFileId ? {blockingFileId: outcome.blockingFileId} : {}),
    }
  );
}

/**
 * Brings each person's access to the workspace's Drive folder in line with their membership, in
 * the background. Failing to start is logged, not thrown: the membership change itself is done.
 */
export async function startDriveAccess(people: DriveAccessParams[]) {
  if (people.length === 0) return;
  try {
    // createBatch takes at most 100 at a time; one person at a time is the usual case.
    for (let i = 0; i < people.length; i += 100) {
      // oxlint-disable-next-line no-await-in-loop -- batches one after another.
      await env.DRIVE_ACCESS_WORKFLOW.createBatch(
        people.slice(i, i + 100).map(params => ({params}))
      );
    }
  } catch (error) {
    console.error("Couldn't start updating Drive folder access", error);
  }
}
