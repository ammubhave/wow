/**
 * Messages to the background (service worker), which owns signing in (the OAuth tokens) and
 * knows which puzzle a page is for. Pages and the content script ask it with `ask`.
 */

/** Who is signed in to the extension (from the OAuth ID token). */
export type ExtensionUser = {id: string; name: string; email: string | null; image: string | null};

/** A page that is a puzzle in your default workspace. */
export type PuzzleMatch = {workspaceSlug: string; puzzleId: string; name: string};

export type Request =
  | {type: "getAccessToken"}
  | {type: "signIn"}
  | {type: "signOut"}
  | {type: "matchUrl"; url: string}
  | {type: "puzzlesChanged"};

export type Response<R extends Request> = R extends {type: "getAccessToken"}
  ? {token: string; expiresAt: number; user: ExtensionUser} | null
  : R extends {type: "signIn"}
    ? {user: ExtensionUser} | {error: string}
    : R extends {type: "matchUrl"}
      ? PuzzleMatch | null
      : null;

export function ask<R extends Request>(request: R): Promise<Response<R>> {
  return browser.runtime.sendMessage(request);
}

/** Messages to a tab's content script. */
export type TabMessage =
  /** Look again whether the page is a puzzle (one was just added or changed). */
  | {type: "recheck"}
  /** Show the sidebar, expanded. */
  | {type: "expand"}
  /** The page's puzzle name, as best it can tell, and its URL: answers `{title, url}`. */
  | {type: "pageInfo"}
  /** The puzzle whose sidebar is open (not collapsed) on the page: answers `{puzzleId}` or null. */
  | {type: "sidebarShown"};

/** Messages from the sidebar (in its iframe) to the content script that hosts it. */
export type SidebarMessage =
  | {source: "wow-sidebar"; type: "collapse"}
  /** Loaded: send what the page says (a `huntSolve`). */
  | {source: "wow-sidebar"; type: "ready"}
  /** Whether it's offering to mark the puzzle solved (the collapsed tab shows a dot when it is). */
  | {source: "wow-sidebar"; type: "solveOffer"; shown: boolean};

/**
 * From the content script to the sidebar: the answer the hunt's page says the puzzle was solved
 * with (lib/hunt-solve.ts), or null. Sent when the sidebar is ready and whenever it changes.
 */
export type PageMessage = {source: "wow-page"; type: "huntSolve"; answer: string | null};
