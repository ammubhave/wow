/**
 * Every docs page, in reading order: the one list behind the docs' sidebar, previous/next links,
 * breadcrumbs and search, the public footer's links and the workspace command palette. A page's
 * content is `content/<slug>.mdx` (`content/index.mdx` for the welcome page), loaded when opened.
 *
 * Sections follow the reader: start here, the ideas behind WOW, then how-to guides in the order a
 * hunt happens (before, during, after), then reference and help.
 */

export type DocSection =
  | "Start here"
  | "Concepts"
  | "Before the hunt"
  | "During the hunt"
  | "After the hunt"
  | "Reference"
  | "Help"
  | "Puzzle Exchange";

export type DocPage = {
  /** The path after /docs (or a workspace's /help): "" for the welcome page. */
  slug: string;
  /** The page's heading and sidebar label. */
  title: string;
  /** One line: what it's for (the page's lead and its search snippet). */
  description: string;
  section: DocSection;
};

export const DOC_PAGES: DocPage[] = [
  // Start here
  {
    slug: "",
    title: "Welcome to WOW",
    description:
      "What WOW is, a quick tour of a workspace, and where to start depending on what you're here to do.",
    section: "Start here",
  },
  {
    slug: "start/solver",
    title: "Quick start for solvers",
    description: "Joined a team? Get from the invitation link to solving your first puzzle.",
    section: "Start here",
  },
  {
    slug: "start/captain",
    title: "Quick start for captains",
    description:
      "Setting WOW up for your team: find the hunt, create a workspace, invite everyone, build the board.",
    section: "Start here",
  },
  {
    slug: "tutorial",
    title: "Tutorial: your first hunt",
    description:
      "A complete walkthrough of a hunt in WOW, from an empty workspace to the final recap.",
    section: "Start here",
  },
  // Concepts
  {
    slug: "concepts/workspaces",
    title: "Workspaces, owners and members",
    description: "What a workspace holds, who can do what, and how teams use one per hunt.",
    section: "Concepts",
  },
  {
    slug: "concepts/hunt-structure",
    title: "Rounds, metas and feeders",
    description:
      "How WOW models a hunt: rounds, meta puzzles, the puzzles that feed them, and puzzles with several answers.",
    section: "Concepts",
  },
  {
    slug: "concepts/live-collaboration",
    title: "Working together live",
    description:
      "Everything in WOW updates live for the whole team: presence, live edits, following teammates, and going offline.",
    section: "Concepts",
  },
  // Before the hunt
  {
    slug: "guides/find-a-hunt",
    title: "Find a hunt",
    description:
      "Browse upcoming puzzle hunts in a list or calendar, and set up a workspace in one click.",
    section: "Before the hunt",
  },
  {
    slug: "guides/create-a-workspace",
    title: "Create a workspace",
    description: "Every field on the create form, and what to do right after.",
    section: "Before the hunt",
  },
  {
    slug: "guides/invite-your-team",
    title: "Invite your team",
    description:
      "Share the invitation link, or the workspace ID and password, and how joining works.",
    section: "Before the hunt",
  },
  {
    slug: "google-drive",
    title: "Connect Google Drive",
    description:
      "Use Google Sheets instead of the built-in spreadsheet: a sheet for every puzzle, in your team's folder.",
    section: "Before the hunt",
  },
  {
    slug: "discord",
    title: "Connect Discord",
    description:
      "Keep a Discord server in step with the board: a voice channel per puzzle, tidied up as puzzles are solved.",
    section: "Before the hunt",
  },
  {
    slug: "guides/customize",
    title: "Make it yours",
    description: "Accent colour, team emoji, custom reaction emoji, header links and tags.",
    section: "Before the hunt",
  },
  {
    slug: "guides/members-and-roles",
    title: "Members and roles",
    description: "See who's in the workspace, make someone an owner, and leave a workspace.",
    section: "Before the hunt",
  },
  // During the hunt
  {
    slug: "blackboard",
    title: "The blackboard",
    description:
      "The team's board of every round and puzzle: adding puzzles, editing in place, filtering and arranging.",
    section: "During the hunt",
  },
  {
    slug: "guides/puzzle-page",
    title: "Working on a puzzle",
    description:
      "The puzzle page: its sheet, whiteboard and chat, the info panel, your timer, and notes.",
    section: "During the hunt",
  },
  {
    slug: "guides/spreadsheet",
    title: "The built-in spreadsheet",
    description:
      "A spreadsheet the whole team edits live, with puzzle formulas, crossword grids and colour highlighting.",
    section: "During the hunt",
  },
  {
    slug: "guides/whiteboard",
    title: "The whiteboard",
    description: "A shared drawing canvas on every puzzle, for diagrams, grids and scribbles.",
    section: "During the hunt",
  },
  {
    slug: "guides/chat",
    title: "Chat and announcements",
    description:
      "Team and puzzle chats: mentions, reactions, images, pins, announcements, and Eggö the bot.",
    section: "During the hunt",
  },
  {
    slug: "guides/inbox",
    title: "The workspace inbox",
    description:
      "The workspace's own email address for the hunt: emails land in the Inbox and notify everyone.",
    section: "During the hunt",
  },
  {
    slug: "guides/voice",
    title: "Voice and screen sharing",
    description:
      "Talk in the lobby or on a puzzle, share your screen, and keep the call as you move around.",
    section: "During the hunt",
  },
  {
    slug: "guides/guess-queue",
    title: "Calling in answers",
    description:
      "The guess queue: line up guesses, wait out backoffs, record what the hunt said, and never repeat a guess.",
    section: "During the hunt",
  },
  {
    slug: "guides/metas",
    title: "Solving metas",
    description:
      "Feeder answers at a glance, copying them as a table, and puzzles with more than one answer.",
    section: "During the hunt",
  },
  {
    slug: "guides/notifications",
    title: "Notifications",
    description:
      "The bell, pop-ups and desktop notifications: what you'll hear about and how to tune it.",
    section: "During the hunt",
  },
  {
    slug: "guides/phone",
    title: "WOW on your phone",
    description: "What changes on a small screen, and how to get around.",
    section: "During the hunt",
  },
  // After the hunt
  {
    slug: "guides/leaderboard",
    title: "Leaderboard and recap",
    description: "Live standings during the hunt, awards, and a shareable recap card afterwards.",
    section: "After the hunt",
  },
  {
    slug: "guides/activity-log",
    title: "The activity log",
    description:
      "Everything that happened on the board, day by day, with filters and the solves chart.",
    section: "After the hunt",
  },
  {
    slug: "guides/your-stats",
    title: "Your stats",
    description:
      "Your puzzling across every hunt: solves, time, favourite puzzle types and teammates.",
    section: "After the hunt",
  },
  // Reference
  {
    slug: "reference/formulas",
    title: "Spreadsheet formulas",
    description:
      "Every puzzle formula in the built-in spreadsheet, with arguments and examples, plus the Google Sheets extras.",
    section: "Reference",
  },
  {
    slug: "reference/shortcuts",
    title: "Keyboard shortcuts",
    description: "Every keyboard shortcut in WOW.",
    section: "Reference",
  },
  {
    slug: "reference/statuses",
    title: "Statuses and importance",
    description: "Each puzzle status and importance level, and what teams use them for.",
    section: "Reference",
  },
  {
    slug: "reference/permissions",
    title: "Permissions",
    description: "What owners and members can each do.",
    section: "Reference",
  },
  {
    slug: "reference/notifications",
    title: "Notification types",
    description: "Every notification, who gets it, and where it takes you.",
    section: "Reference",
  },
  {
    slug: "reference/eggo",
    title: "Eggö commands",
    description: "The chat bot's commands.",
    section: "Reference",
  },
  {
    slug: "reference/account",
    title: "Your account",
    description: "Signing in, passkeys, Google, sessions, and deleting your account.",
    section: "Reference",
  },
  {
    slug: "reference/glossary",
    title: "Glossary",
    description: "Puzzle hunt and WOW terms, defined.",
    section: "Reference",
  },
  // Help
  {
    slug: "help/troubleshooting",
    title: "Troubleshooting",
    description:
      "Fixes for Google Sheets errors, voice on campus Wi-Fi, swipe navigation, and going offline.",
    section: "Help",
  },
  {
    slug: "help/faq",
    title: "FAQ",
    description: "Common questions, and how to get help, report a bug or suggest a feature.",
    section: "Help",
  },
  // Puzzle Exchange
  {
    slug: "exchange",
    title: "The Puzzle Exchange",
    description: "Monthly puzzles from the community: solving them, hints, and writing your own.",
    section: "Puzzle Exchange",
  },
];

export const DOC_SECTIONS: DocSection[] = [...new Set(DOC_PAGES.map(page => page.section))];

/** The page at a slug (trailing slashes ignored). */
export const findDoc = (slug: string) =>
  DOC_PAGES.find(page => page.slug === slug.replace(/^\/+|\/+$/g, ""));

/** The pages before and after one, in reading order. */
export function neighbours(slug: string) {
  const index = DOC_PAGES.findIndex(page => page.slug === slug);
  return {previous: DOC_PAGES[index - 1], next: index >= 0 ? DOC_PAGES[index + 1] : undefined};
}

/** Each page's content, loaded when it's first opened. */
const CONTENT = import.meta.glob<{default: React.ComponentType<{components?: object}>}>(
  "./content/**/*.mdx"
);

export const contentPath = (slug: string) => `./content/${slug || "index"}.mdx`;

export function loadDoc(slug: string) {
  const load = CONTENT[contentPath(slug)];
  return load ? load() : Promise.reject(new Error(`No content for docs page "${slug}"`));
}

/** Pages' raw text (for search), loaded the first time someone searches. */
export const RAW_CONTENT = import.meta.glob<string>("./content/**/*.mdx", {
  query: "?raw",
  import: "default",
});
