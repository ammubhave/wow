import {ListBox} from "@heroui/react";

import type {useWorkspace} from "@/hooks/use-workspace";
import {isWithin} from "@/lib/board-order";

type Rounds = ReturnType<typeof useWorkspace>["rounds"];

/**
 * Where a puzzle can go, for a Select, round by round: each round's metas, plus the round
 * itself (unassigned: in the round, feeding no meta). Keys are round ids and meta ids, the way
 * `puzzles.update`'s `parentPuzzleId` takes them.
 */
export function PlacementOptions({rounds, excludeId}: {rounds: Rounds; excludeId?: string}) {
  // Not the puzzle itself, nor a meta feeding it (directly or through other metas): that would
  // make a loop.
  const parents = new Map(rounds.flatMap(r => r.puzzles).map(p => [p.id, p.parentPuzzleId]));
  const allowed = (metaId: string) =>
    excludeId === undefined || !isWithin(id => parents.get(id), metaId, excludeId);
  return rounds.map(round => (
    <ListBox.Section key={round.id}>
      {/* Each option names its round too, so the closed Select says where it goes. */}
      <ListBox.Item id={round.id} textValue={`${round.name}, no meta`}>
        <span className="truncate">
          {round.name} <span className="text-muted">· no meta</span>
        </span>
        <ListBox.ItemIndicator />
      </ListBox.Item>
      {round.metaPuzzles
        .filter(meta => allowed(meta.id))
        .map(meta => (
          <ListBox.Item key={meta.id} id={meta.id} textValue={`${round.name}, feeds ${meta.name}`}>
            <span className="truncate">
              {round.name} <span className="text-muted">· feeds</span> {meta.name}
            </span>
            <ListBox.ItemIndicator />
          </ListBox.Item>
        ))}
    </ListBox.Section>
  ));
}

/** Whether `placement` (from PlacementOptions) is a round rather than a meta. */
export const isRoundPlacement = (rounds: Rounds, placement: string) =>
  rounds.some(round => round.id === placement);
