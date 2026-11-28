import type {createRouter} from "@tanstack/react-router";

/** The router's view transition options (its `defaultViewTransition`, as an object). */
type ViewTransitionOptions = Exclude<
  Parameters<typeof createRouter>[0]["defaultViewTransition"],
  boolean | undefined
>;

/*
 * Page changes animate (a quick cross-fade) with the browser's view transitions, which the router
 * starts around a navigation (`defaultViewTransition` in router.tsx). React's own <ViewTransition>
 * can't: the router's state reaches React through useSyncExternalStore, which renders navigations
 * synchronously, outside a transition. Timing and reduced motion: styles.css.
 *
 * Opening a puzzle from the board, or going back, its name moves between its row and the puzzle's
 * page (the info panel's heading). Only that one puzzle's name takes part: naming every row would
 * make the browser snapshot each of them on every navigation.
 */

/** The puzzle whose name moves in the current page change. */
let moving: string | null = null;

const transitionName = (puzzleId: string) => `puzzle-name-${puzzleId}`;

/** What a path shows: a puzzle (`puzzleId`), or a section of the workspace (board, settings…). */
function page(pathname: string | undefined) {
  const [workspace, section, id] = (pathname ?? "").split("/").filter(Boolean);
  if (section === "puzzles" && id) return {key: `puzzle:${id}`, puzzleId: id};
  return {key: `${workspace ?? ""}/${section ?? ""}`, puzzleId: null, board: section === undefined};
}

/** Animates a change of page, not changes within one (search params, a puzzle's tabs, filters). */
export const pageTransitions: ViewTransitionOptions = {
  types: ({fromLocation, toLocation}) => {
    const from = page(fromLocation?.pathname);
    const to = page(toLocation.pathname);
    if (!fromLocation || from.key === to.key) return false;
    // Between the board and a puzzle: its name moves. Named now on the page being left (already
    // on screen); the page coming in names it as it renders (PuzzleName).
    moving =
      "board" in from && from.board
        ? to.puzzleId
        : "board" in to && to.board
          ? from.puzzleId
          : null;
    if (moving) {
      for (const element of document.querySelectorAll<HTMLElement>(
        `[data-puzzle-name="${CSS.escape(moving)}"]`
      )) {
        element.style.viewTransitionName = transitionName(moving);
      }
    }
    // Once it's done (the transition takes 200ms), no name stays behind for the next one.
    setTimeout(() => {
      moving = null;
      for (const element of document.querySelectorAll<HTMLElement>("[data-puzzle-name]")) {
        element.style.removeProperty("view-transition-name");
      }
    }, 1000);
    return ["page"];
  },
};

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
