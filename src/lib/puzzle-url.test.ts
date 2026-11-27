import {describe, expect, it} from "vite-plus/test";

import {findPuzzleForUrl, puzzleUrlKey} from "./puzzle-url";

const puzzle = (id: string, link: string | null) => ({id, link});

describe("puzzle links", () => {
  it("ignores scheme, www, host case, trailing slash, index page and fragment", () => {
    const key = puzzleUrlKey("https://www.Example.com/puzzles/foo/");
    expect(puzzleUrlKey("http://example.com/puzzles/foo#answer")).toEqual(key);
    expect(puzzleUrlKey("https://example.com/puzzles/foo/index.html")).toEqual(key);
  });

  it("keeps the port and sorts the query", () => {
    expect(puzzleUrlKey("http://localhost:8000/p?b=2&a=1")).toEqual({
      base: "localhost:8000/p",
      query: "a=1&b=2",
    });
  });

  it("isn't a web link", () => {
    expect(puzzleUrlKey("not a url")).toBeNull();
    expect(puzzleUrlKey("mailto:a@b.c")).toBeNull();
  });

  it("finds the puzzle, preferring the same query over none", () => {
    const puzzles = [
      puzzle("none", null),
      puzzle("loose", "https://hunt.example/p/1"),
      puzzle("exact", "https://hunt.example/p/1?round=2"),
      puzzle("other", "https://hunt.example/p/2"),
    ];
    expect(findPuzzleForUrl("https://hunt.example/p/1?round=2", puzzles)?.id).toBe("exact");
    expect(findPuzzleForUrl("https://hunt.example/p/1?utm=x", puzzles)?.id).toBe("loose");
    expect(findPuzzleForUrl("https://hunt.example/p/1/", puzzles)?.id).toBe("loose");
    expect(findPuzzleForUrl("https://hunt.example/p/3", puzzles)).toBeUndefined();
  });

  it("doesn't match a puzzle whose link has a query the page lacks", () => {
    const puzzles = [puzzle("q", "https://hunt.example/p?id=7")];
    expect(findPuzzleForUrl("https://hunt.example/p", puzzles)).toBeUndefined();
  });
});
