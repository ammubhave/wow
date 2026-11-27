import {describe, expect, it} from "vite-plus/test";

import {findHuntSolve} from "./hunt-solve";

describe("findHuntSolve", () => {
  it.each([
    ["Solved: LANTERN", "LANTERN"],
    ["Answer: PAPER LANTERN", "PAPER LANTERN"],
    ["SOLVED! LANTERN", "LANTERN"],
    ["✓ Solution — LANTERN", "LANTERN"],
    ["LANTERN is correct!", "LANTERN"],
    ["Correct! The answer is LANTERN.", "LANTERN"],
    ["You solved it! The answer was DON'T PANIC", "DON'T PANIC"],
    ["LANTERN\tCorrect\t2:14 PM", "LANTERN"],
    ["LANTERN | Correct", "LANTERN"],
    ["Answer: R2D2", "R2D2"],
  ])("finds the answer in %j", (text, answer) => {
    expect(findHuntSolve(text)).toBe(answer);
  });

  it.each([
    "Enter your answer below.",
    "The answer is hidden in the grid.",
    "Answer: lantern",
    "Answer: A",
    "Solved: 12",
    "Answer: ???",
    "Answer: UNSOLVED",
    "LAMP\tIncorrect",
    "Puzzles solved: 3 / 40",
  ])("finds nothing in %j", text => {
    expect(findHuntSolve(text)).toBeNull();
  });

  it("reads line by line, and takes the first that says", () => {
    const page = ["Hunt 2027", "Puzzles", "Lantern Lore", "Solved: LANTERN", "", "LAMP\tIncorrect"];
    expect(findHuntSolve(page.join("\n"))).toBe("LANTERN");
    const log = ["Guesses", "LANTERN\tCorrect", "LAMP\tIncorrect"].join("\n");
    expect(findHuntSolve(log)).toBe("LANTERN");
  });
});
