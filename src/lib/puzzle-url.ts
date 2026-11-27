/**
 * Matching a web page to a puzzle by its link (the Chrome extension: on a hunt's page for one of
 * your puzzles, it shows that puzzle). Links are compared loosely, as people paste them: the
 * scheme, a "www.", the case of the host, a trailing slash or index page, the fragment and the
 * order of query parameters don't matter. A puzzle linked without a query also matches the page
 * with one (hunt sites add tracking or state parameters), but not the other way round.
 */

/** A link as compared: host, path and sorted query, or null for something that isn't a web link. */
export function puzzleUrlKey(link: string): {base: string; query: string} | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const port = url.port ? `:${url.port}` : "";
  const path = url.pathname.replace(/\/index\.html?$/i, "/").replace(/\/+$/, "") || "/";
  const params = [...url.searchParams.entries()].toSorted(([a, x], [b, y]) =>
    a === b ? x.localeCompare(y) : a.localeCompare(b)
  );
  return {base: `${host}${port}${path}`, query: new URLSearchParams(params).toString()};
}

/**
 * The puzzle a page is for, among `puzzles` (by link), preferring an exact match (same query) over
 * one whose link has no query. Undefined when none is.
 */
export function findPuzzleForUrl<T extends {link: string | null}>(
  pageUrl: string,
  puzzles: readonly T[]
): T | undefined {
  const page = puzzleUrlKey(pageUrl);
  if (!page) return undefined;
  let loose: T | undefined;
  for (const puzzle of puzzles) {
    const key = puzzle.link ? puzzleUrlKey(puzzle.link) : null;
    if (!key || key.base !== page.base) continue;
    if (key.query === page.query) return puzzle;
    if (!key.query) loose ??= puzzle;
  }
  return loose;
}
