import {describe, expect, it} from "vite-plus/test";

import {
  formatAnswers,
  joinAnswers,
  normalizeAnswer,
  solvedByAnswer,
  parseTypedAnswers,
  splitAnswers,
} from "./answers";

describe("answers", () => {
  it("keeps several answers one per line", () => {
    expect(joinAnswers(["foo", " bar ", ""])).toBe("FOO\nBAR");
    expect(joinAnswers([])).toBeNull();
    expect(splitAnswers("FOO\nBAR\n")).toEqual(["FOO", "BAR"]);
    expect(splitAnswers(null)).toEqual([]);
  });

  it("shows them with a dot, and reads them back from ; or the dot", () => {
    expect(formatAnswers("FOO\nBAR")).toBe("FOO · BAR");
    expect(parseTypedAnswers("foo; bar")).toBe("FOO\nBAR");
    expect(parseTypedAnswers("FOO · BAR")).toBe("FOO\nBAR");
    expect(parseTypedAnswers("  ")).toBeNull();
  });

  it("compares guesses ignoring case, spaces and punctuation", () => {
    expect(normalizeAnswer("Ice-cream bar!")).toBe(normalizeAnswer("ICECREAMBAR"));
    expect(normalizeAnswer("café")).toBe("CAFÉ");
  });
});

describe("solvedByAnswer", () => {
  it("marks a puzzle solved once all its answers are in", () => {
    expect(solvedByAnswer("KEYHOLE", {answerCount: 1, status: null})).toEqual({status: "solved"});
    expect(solvedByAnswer("RED", {answerCount: 2, status: "active"})).toEqual({});
    expect(solvedByAnswer(joinAnswers(["RED", "BLUE"]), {answerCount: 2, status: null})).toEqual({
      status: "solved",
    });
  });
  it("leaves solved puzzles and cleared answers alone", () => {
    expect(solvedByAnswer("KEYHOLE", {answerCount: 1, status: "backsolved"})).toEqual({});
    expect(solvedByAnswer("", {answerCount: 1, status: "active"})).toEqual({});
  });
});
