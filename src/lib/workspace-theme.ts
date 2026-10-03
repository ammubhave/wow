import {z} from "zod";

/**
 * A workspace's look: an accent color (tints buttons, progress bars, highlights) and an emoji
 * (beside the team name, and in solve celebrations), plus the team's custom reaction emoji.
 */
export const ACCENTS = [
  {id: "default", label: "Waffle (default)", color: null},
  {id: "red", label: "Red", color: "oklch(63% 0.21 25)"},
  {id: "pink", label: "Pink", color: "oklch(66% 0.2 350)"},
  {id: "violet", label: "Violet", color: "oklch(62% 0.2 295)"},
  {id: "blue", label: "Blue", color: "oklch(62% 0.18 255)"},
  {id: "teal", label: "Teal", color: "oklch(68% 0.12 190)"},
  {id: "green", label: "Green", color: "oklch(68% 0.17 145)"},
  {id: "gold", label: "Gold", color: "oklch(78% 0.15 85)"},
] as const;
export type AccentId = (typeof ACCENTS)[number]["id"];

const customEmojiSchema = z.object({
  name: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  fileId: z.string().regex(/^[0-9a-f]{64}$/),
});
export type CustomEmoji = z.infer<typeof customEmojiSchema>;

export const workspaceThemeSchema = z.object({
  accent: z.enum(ACCENTS.map(a => a.id)).optional(),
  emoji: z.string().max(16).optional(),
  customEmoji: customEmojiSchema.array().max(100).optional(),
});
export type WorkspaceTheme = z.infer<typeof workspaceThemeSchema>;

/** The stored theme, or an empty one if it's missing or malformed. */
export const parseTheme = (value: unknown): WorkspaceTheme =>
  workspaceThemeSchema.catch({}).parse(value ?? {});

/**
 * Applies an accent color to the whole page (the root element), with the shades HeroUI derives
 * from it (those are computed at the root, so they must be overridden alongside). Returns a
 * function that restores the default.
 */
export function applyAccent(accent: AccentId | undefined) {
  const color = ACCENTS.find(a => a.id === accent)?.color;
  const root = document.documentElement;
  const vars = {
    "--accent": color,
    "--accent-hover": color && `color-mix(in oklab, ${color} 90%, var(--accent-foreground) 10%)`,
    "--accent-soft": color && `color-mix(in oklab, ${color} 15%, transparent)`,
    "--accent-soft-hover": color && `color-mix(in oklab, ${color} 20%, transparent)`,
    "--accent-soft-foreground": color && `color-mix(in oklab, ${color} 75%, var(--foreground) 25%)`,
  };
  for (const [name, value] of Object.entries(vars)) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
  return () => {
    for (const name of Object.keys(vars)) root.style.removeProperty(name);
  };
}
