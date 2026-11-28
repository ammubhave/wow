import type {AnyRouter} from "@tanstack/react-router";

/*
 * Page changes animate (a quick cross-fade) with the browser's view transitions, which the router
 * starts around a navigation when asked to. React's own <ViewTransition> can't: the router's state
 * reaches React through useSyncExternalStore, which renders navigations synchronously, outside a
 * transition. Timing and reduced motion: styles.css.
 *
 * Each navigation is judged as it starts (onBeforeNavigate, while the old page is still up): only a
 * change of page animates, not changes within one (search params, a puzzle's tabs, filters). This
 * is done here rather than with the router's view transition "types", which every navigation would
 * animate in browsers without `:active-view-transition-type` (Firefox).
 *
 * Opening a puzzle from the board, or going back, its name moves between its row and the puzzle's
 * page (the info panel's heading). Only that one puzzle's name takes part: naming every row would
 * make the browser snapshot each of them on every navigation.
 */

/** Set on <html> during a page change; styles.css names the page area while it's there. */
const ATTRIBUTE = "data-page-transition";

/** The puzzle whose name moves in the current page change. */
let moving: string | null = null;
/** Counts navigations, so a late cleanup from one doesn't undo the next one's names. */
let navigation = 0;

const transitionName = (puzzleId: string) => `puzzle-name-${puzzleId}`;

/** What a path shows: a puzzle, or a section of the workspace (the board, settings…). */
function page(pathname: string | undefined) {
  const [workspace, section, id] = (pathname ?? "").split("/").filter(Boolean);
  if (section === "puzzles" && id) return {key: `puzzle:${id}`, puzzleId: id, board: false};
  return {key: `${workspace ?? ""}/${section ?? ""}`, puzzleId: null, board: section === undefined};
}

/** No names left behind (after a page change, or one that didn't happen). */
function clear() {
  moving = null;
  document.documentElement.removeAttribute(ATTRIBUTE);
  for (const element of document.querySelectorAll<HTMLElement>("[data-puzzle-name]")) {
    element.style.removeProperty("view-transition-name");
  }
}

/** Whether a navigation changes page; if it does, names what moves (on the page being left). */
function prepare(fromPathname: string | undefined, toPathname: string) {
  navigation++;
  clear();
  const from = page(fromPathname);
  const to = page(toPathname);
  if (fromPathname === undefined || from.key === to.key) return false;
  document.documentElement.setAttribute(ATTRIBUTE, "");
  // Between the board and a puzzle, its name moves: named now on the page being left (on screen
  // already), and by the page coming in as it renders (PuzzleName).
  moving = from.board ? to.puzzleId : to.board ? from.puzzleId : null;
  if (moving) {
    for (const element of document.querySelectorAll<HTMLElement>(
      `[data-puzzle-name="${CSS.escape(moving)}"]`
    )) {
      element.style.viewTransitionName = transitionName(moving);
    }
  }
  return true;
}

/** Animates the router's changes of page (see above). */
export function animatePageChanges(router: AnyRouter) {
  router.subscribe("onBeforeNavigate", ({fromLocation, toLocation}) => {
    // Read when the router commits the new page (this navigation's own `viewTransition` option,
    // which nothing here uses, is replaced).
    router.shouldViewTransition = prepare(fromLocation?.pathname, toLocation.pathname);
  });
  // The new page is in: the snapshots are taken, so the names can go once the cross-fade (200ms)
  // is over.
  router.subscribe("onResolved", () => {
    if (!document.documentElement.hasAttribute(ATTRIBUTE)) return;
    const current = navigation;
    setTimeout(() => {
      if (navigation === current) clear();
    }, 400);
  });
}

/** A puzzle's name, which moves between the board and the puzzle's page (see above). */
export function PuzzleName({puzzleId, name}: {puzzleId: string; name: string}) {
  return (
    <span
      data-puzzle-name={puzzleId}
      style={puzzleId === moving ? {viewTransitionName: transitionName(puzzleId)} : undefined}>
      {name}
    </span>
  );
}
