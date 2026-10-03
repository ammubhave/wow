/**
 * Product analytics: the PostHog event each workspace procedure records when it succeeds (reads
 * record nothing). Properties describe what happened, never content: no puzzle names, answers or
 * messages.
 */
type Input = Record<string, unknown>;
type Describe = (input: Input) => Record<string, unknown>;

/** Which fields an update changed (by name only). */
const changedFields = (input: Input) =>
  Object.keys(input).filter(
    key => !["workspaceSlug", "id", "userId"].includes(key) && input[key] !== undefined
  );

const none: Describe = () => ({});

export const TRACKED_PROCEDURES: Record<string, [event: string, describe: Describe]> = {
  "puzzles.create": [
    "puzzle_created",
    input => ({
      isMeta: input.type === "meta-puzzle",
      worksheetType: input.worksheetType,
      hasLink: Boolean(input.link),
      tagCount: Array.isArray(input.tags) ? input.tags.length : 0,
    }),
  ],
  // Solving is its own event too ("puzzle_solved", from the handler: it knows the transition).
  "puzzles.update": [
    "puzzle_updated",
    input => ({fields: changedFields(input), status: input.status ?? undefined}),
  ],
  "puzzles.delete": ["puzzle_deleted", none],
  "rounds.create": ["round_created", none],
  "rounds.update": ["round_updated", input => ({fields: changedFields(input)})],
  "rounds.delete": ["round_deleted", none],
  "rounds.assignUnassignedPuzzles": ["round_puzzles_assigned", none],
  "workspaces.update": ["workspace_updated", input => ({fields: changedFields(input)})],
  "workspaces.leave": ["workspace_left", none],
  "workspaces.setGoogleFolderId": ["google_drive_configured", () => ({setting: "folder"})],
  "workspaces.setGoogleTemplateFileId": ["google_drive_configured", () => ({setting: "template"})],
  "workspaces.shareGoogleDriveFolder": ["google_drive_folder_shared", none],
  "workspaces.customEmoji.add": ["custom_emoji_added", none],
  "workspaces.customEmoji.remove": ["custom_emoji_removed", none],
  "workspaces.members.updateRole": ["member_role_changed", input => ({role: input.role})],
  "workspaces.members.set": [
    "favorites_updated",
    input => ({count: Array.isArray(input.favoritePuzzleIds) ? input.favoritePuzzleIds.length : 0}),
  ],
  "workspaces.announce": ["announcement_sent", input => ({toDiscord: Boolean(input.channelId)})],
  "workspaces.discord.disconnect": ["discord_disconnected", none],
};
