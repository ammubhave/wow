import {ToggleButton, Tooltip} from "@heroui/react";
import {useMutation, useQuery} from "@tanstack/react-query";
import {HandIcon} from "lucide-react";

import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import {workspaceMutations} from "@/lib/workspace-mutations";

import {UserPresenceAvatars} from "./user-hover-card";

/** The workspace's members by id (for showing who helped). */
function useMembersById(workspaceSlug: string) {
  const {data} = useQuery(orpc.workspaces.members.list.queryOptions({input: {workspaceSlug}}));
  return new Map(data?.members.map(m => [m.user.id, m.user]));
}

/** The people who say they helped solve a puzzle, as avatars (names on hover). */
export function PuzzleContributorAvatars({
  workspaceSlug,
  contributorIds,
  max,
}: {
  workspaceSlug: string;
  contributorIds: readonly string[];
  max?: number;
}) {
  const members = useMembersById(workspaceSlug);
  const users = contributorIds.flatMap(id => {
    const user = members.get(id);
    return user ? [user] : [];
  });
  return <UserPresenceAvatars users={users} max={max} />;
}

/**
 * "I helped": mark yourself as having helped solve a puzzle (or take it back). Self-reported on the
 * team's honor code, since who worked on a puzzle can't be told from who marked it solved.
 */
export function HelpedToggle({
  workspaceSlug,
  puzzleId,
  contributorIds,
}: {
  workspaceSlug: string;
  puzzleId: string;
  contributorIds: readonly string[];
}) {
  const me = authClient.useSession().data?.user.id;
  const {mutate} = useMutation(workspaceMutations.puzzles.setContributor());
  if (!me) return null;
  const helped = contributorIds.includes(me);
  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger>
        <ToggleButton
          size="sm"
          isSelected={helped}
          onChange={contributed => mutate({workspaceSlug, puzzleId, userId: me, contributed})}>
          <HandIcon />
          {helped ? "You helped" : "I helped"}
        </ToggleButton>
      </Tooltip.Trigger>
      <Tooltip.Content>
        {helped
          ? "You're credited for helping solve this. Press to undo."
          : "Mark yourself if you helped solve this puzzle (honor code)."}
      </Tooltip.Content>
    </Tooltip>
  );
}
