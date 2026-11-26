/**
 * Pure planning for the Discord channel sync (src/server/do/discord-client.ts): given the board and
 * the guild's existing 🧩 channels, decide which channels to create, move, rename, retire or delete.
 * No I/O here, so it can be unit tested.
 *
 * The model: one category (type 4) per round with unsolved puzzles, and one voice channel (type 2)
 * per unsolved puzzle inside its round's category. Categories and voice channels are matched
 * separately, so a round and a puzzle may share a name.
 */

export const CATEGORY = 4;
export const VOICE = 2;

/** Discord caps channel names at 100 characters; leave room for the "🧩 " / "✅ " prefixes. */
const MAX_NAME_LENGTH = 90;

/** The name a channel gets (and is matched by), without the "🧩 " prefix. */
export function channelName(name: string) {
  const trimmed = name.trim();
  // By grapheme, so truncating never splits an emoji.
  const graphemes = Array.from(new Intl.Segmenter().segment(trimmed), ({segment}) => segment);
  return graphemes.length > MAX_NAME_LENGTH
    ? graphemes.slice(0, MAX_NAME_LENGTH).join("").trimEnd()
    : trimmed;
}

export type SyncPuzzle = {
  /** The puzzle's id, when the caller provides it: lets a channel follow its puzzle across renames. */
  id?: string;
  name: string;
  status: string | null;
  importance: string | null;
  isMetaPuzzle: boolean;
};

export type SyncRound = {name: string; puzzles: SyncPuzzle[]};

/** A 🧩 channel in the guild, with the prefix stripped from its name. */
export type ExistingChannel = {id: string; name: string; type: number; parentId: string | null};

export type DesiredPuzzle = {id?: string; name: string};
export type DesiredRound = {name: string; puzzles: DesiredPuzzle[]};

/** Rounds with unsolved puzzles, in board order; rounds sharing a name share a category. */
export function desiredRounds(rounds: SyncRound[]): DesiredRound[] {
  const byName = new Map<string, DesiredRound>();
  for (const round of rounds) {
    const puzzles = round.puzzles
      .filter(
        puzzle =>
          // Done with: solved, or marked Obsolete (an importance, not a status).
          puzzle.status !== "solved" &&
          puzzle.status !== "backsolved" &&
          puzzle.importance !== "obsolete"
      )
      .map(puzzle => ({
        id: puzzle.id,
        name: channelName(`${puzzle.isMetaPuzzle ? "[META] " : ""}${puzzle.name}`),
      }));
    if (puzzles.length === 0) continue;
    const name = channelName(round.name);
    const existing = byName.get(name);
    if (existing) existing.puzzles.push(...puzzles);
    else byName.set(name, {name, puzzles});
  }
  return [...byName.values()];
}

/** What to do for one unsolved puzzle. `round` names the category (it may not exist yet). */
export type VoiceAction =
  | {kind: "create"; puzzleId?: string; name: string; round: string}
  | {
      kind: "update";
      puzzleId?: string;
      channelId: string;
      /** Set when the channel needs renaming (a mapped puzzle was renamed). */
      name?: string;
      /** Set when the channel needs moving to this round's category. */
      round?: string;
    }
  | {kind: "keep"; puzzleId?: string; channelId: string};

export type SyncPlan = {
  /** Round names whose category to create, in board order. */
  createCategories: string[];
  /** Round name → id of the existing category kept for it. */
  categories: Map<string, string>;
  /** One action per unsolved puzzle, in board order. */
  voices: VoiceAction[];
  /** Voice channels whose puzzle is done: renamed "✅ …" and deleted after a delay. */
  retireVoices: {id: string; name: string; parentId: string | null}[];
  /** Surplus voice channels: same name as a puzzle that already has its channel. */
  deleteVoices: string[];
  /** Categories for rounds that are done, and duplicates of kept ones. Deleted last. */
  deleteCategories: string[];
};

/**
 * @param puzzleChannels stored puzzle id → voice channel id from earlier syncs; channels created
 *   before the mapping existed (or puzzles without ids) are matched by name instead.
 */
export function planSync(
  rounds: DesiredRound[],
  existing: ExistingChannel[],
  puzzleChannels: Record<string, string> = {}
): SyncPlan {
  // Categories: keep one per round name, preferring the one holding the most voice channels.
  const childCount = new Map<string, number>();
  for (const channel of existing) {
    if (channel.type === VOICE && channel.parentId) {
      childCount.set(channel.parentId, (childCount.get(channel.parentId) ?? 0) + 1);
    }
  }
  const existingCategories = existing.filter(channel => channel.type === CATEGORY);
  const categories = new Map<string, string>();
  const createCategories: string[] = [];
  for (const round of rounds) {
    const candidates = existingCategories.filter(category => category.name === round.name);
    if (candidates.length === 0) {
      createCategories.push(round.name);
      continue;
    }
    const best = candidates.reduce((a, b) =>
      (childCount.get(b.id) ?? 0) > (childCount.get(a.id) ?? 0) ? b : a
    );
    categories.set(round.name, best.id);
  }
  const keptCategoryIds = new Set(categories.values());
  const deleteCategories = existingCategories
    .filter(category => !keptCategoryIds.has(category.id))
    .map(category => category.id);

  // Voice channels: match each unsolved puzzle to at most one channel, in passes from most to
  // least specific, each over the whole board, so one pass never steals another's better match.
  const voices = existing.filter(channel => channel.type === VOICE);
  const voiceById = new Map(voices.map(channel => [channel.id, channel]));
  const unclaimed = new Set(voices.map(channel => channel.id));
  const slots = rounds.flatMap(round => round.puzzles.map(puzzle => ({round: round.name, puzzle})));
  const matched: (ExistingChannel | undefined)[] = slots.map(() => undefined);

  const claim = (index: number, channel: ExistingChannel | undefined) => {
    if (!channel || !unclaimed.has(channel.id)) return false;
    unclaimed.delete(channel.id);
    matched[index] = channel;
    return true;
  };

  // 1. The channel stored for this puzzle id, whatever its name or category now.
  slots.forEach(({puzzle}, index) => {
    const channelId = puzzle.id ? puzzleChannels[puzzle.id] : undefined;
    if (channelId) claim(index, voiceById.get(channelId));
  });
  // 2. Same name, already in this round's category.
  slots.forEach(({round, puzzle}, index) => {
    if (matched[index]) return;
    const categoryId = categories.get(round);
    if (!categoryId) return;
    claim(
      index,
      voices.find(
        channel =>
          unclaimed.has(channel.id) &&
          channel.name === puzzle.name &&
          channel.parentId === categoryId
      )
    );
  });
  // 3. Same name anywhere (moved between rounds, or its category is a duplicate).
  slots.forEach(({puzzle}, index) => {
    if (matched[index]) return;
    claim(
      index,
      voices.find(channel => unclaimed.has(channel.id) && channel.name === puzzle.name)
    );
  });

  const voiceActions: VoiceAction[] = slots.map(({round, puzzle}, index) => {
    const channel = matched[index];
    if (!channel) return {kind: "create", puzzleId: puzzle.id, name: puzzle.name, round};
    const name = channel.name === puzzle.name ? undefined : puzzle.name;
    const categoryId = categories.get(round);
    const moveTo = categoryId !== undefined && channel.parentId === categoryId ? undefined : round;
    if (name === undefined && moveTo === undefined) {
      return {kind: "keep", puzzleId: puzzle.id, channelId: channel.id};
    }
    return {
      kind: "update",
      puzzleId: puzzle.id,
      channelId: channel.id,
      ...(name !== undefined && {name}),
      ...(moveTo !== undefined && {round: moveTo}),
    };
  });

  // Unclaimed channels: a duplicate of a puzzle that has its channel is deleted now (as before);
  // anything else is a done puzzle's, retired so whoever is in it can finish up.
  const desiredNames = new Set(slots.map(({puzzle}) => puzzle.name));
  const retireVoices: SyncPlan["retireVoices"] = [];
  const deleteVoices: string[] = [];
  for (const channel of voices) {
    if (!unclaimed.has(channel.id)) continue;
    if (desiredNames.has(channel.name)) deleteVoices.push(channel.id);
    else retireVoices.push({id: channel.id, name: channel.name, parentId: channel.parentId});
  }

  return {
    createCategories,
    categories,
    voices: voiceActions,
    retireVoices,
    deleteVoices,
    deleteCategories,
  };
}

/** Seconds to wait before retrying a 429, from its JSON body or Retry-After header. */
export function retryAfterSeconds(body: unknown, header: string | null): number {
  if (typeof body === "object" && body !== null && "retry_after" in body) {
    const value = Number(body.retry_after);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  const value = header === null ? Number.NaN : Number(header);
  if (Number.isFinite(value) && value >= 0) return value;
  return 1;
}
