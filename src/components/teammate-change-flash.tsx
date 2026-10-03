import {Avatar} from "@heroui/react";
import {useQuery} from "@tanstack/react-query";
import {useParams} from "@tanstack/react-router";

import {userAvatarSrc, userInitials} from "@/components/user-hover-card";
import {useMountedAt} from "@/lib/arrivals";
import {authClient} from "@/lib/auth-client";
import {workspaceQueryOptions} from "@/lib/workspace-mutations";

const CHANGES = new Set(["updateStatus", "updateAnswer", "updateImportance"]);

/**
 * On a board row: when a teammate changes the puzzle (status, answer, importance), the cell
 * glows briefly and their avatar pops up beside the name, so the board feels alive. Reads just
 * this puzzle's latest change from the workspace cache, so a row re-renders only for its own.
 */
export function TeammateChangeFlash({puzzleId}: {puzzleId: string}) {
  const {workspaceSlug} = useParams({from: "/_workspace/$workspaceSlug"});
  const me = authClient.useSession().data?.user.id;
  const mountedAt = useMountedAt();
  const change = useQuery({
    ...workspaceQueryOptions(workspaceSlug),
    select: wire => {
      const entry = wire.activityLogEntries.find(
        e =>
          e.puzzle_activity_log_entry?.puzzleId === puzzleId &&
          CHANGES.has(e.puzzle_activity_log_entry.subType)
      );
      return (
        entry && {
          id: entry.activity_log_entry.id,
          createdAt: entry.activity_log_entry.createdAt,
          user: entry.user,
        }
      );
    },
  }).data;
  // Only changes made while you're watching, by someone else.
  if (!change?.user || change.user.id === me) return null;
  if (new Date(change.createdAt).getTime() < mountedAt) return null;
  return (
    <>
      <span
        key={`${change.id}-glow`}
        aria-hidden
        className="animate-teammate-glow bg-accent/25 pointer-events-none absolute inset-0"
      />
      <span
        key={`${change.id}-who`}
        className="animate-teammate-badge pointer-events-none absolute end-1 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-black/60 py-0.5 ps-0.5 pe-2 text-[10px] text-white"
        aria-live="polite">
        <Avatar size="sm" className="size-4 text-[7px]">
          <Avatar.Image src={userAvatarSrc(change.user)} alt="" />
          <Avatar.Fallback>{userInitials(change.user.name)}</Avatar.Fallback>
        </Avatar>
        {change.user.name.split(" ")[0]}
      </span>
    </>
  );
}
