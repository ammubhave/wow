import {describe, expect, test} from "vite-plus/test";

import {anagrams, buildWordList, compilePattern, matches} from "./wordlist";

// Best first, like the real list.
const list = buildWordList(
  [
    "ICECREAM",
    "CAT",
    "ACT",
    "TAC",
    "COT",
    "CUT",
    "NEWYORK",
    "STONE",
    "NOTES",
    "ONSET",
    "TONES",
  ].join("\n")
);

describe("matches", () => {
  test("? . and _ are any letter", () => {
    expect(matches(list, "C?T", 10)).toEqual(["CAT", "COT", "CUT"]);
    expect(matches(list, "c.t", 10)).toEqual(["CAT", "COT", "CUT"]);
    expect(matches(list, "C_T", 1)).toEqual(["CAT"]);
  });
  test("* is any run of letters; spaces are ignored", () => {
    expect(matches(list, "ICE*", 10)).toEqual(["ICECREAM"]);
    expect(matches(list, "new york", 10)).toEqual(["NEWYORK"]);
  });
  test("@ is a vowel, # a consonant, [..] a set", () => {
    expect(matches(list, "C@T", 10)).toEqual(["CAT", "COT", "CUT"]);
    expect(matches(list, "#AT", 10)).toEqual(["CAT"]);
    expect(matches(list, "C[OU]T", 10)).toEqual(["COT", "CUT"]);
  });
  test("an empty pattern matches nothing", () => {
    expect(compilePattern("  ")).toBeNull();
    expect(matches(list, "", 10)).toEqual([]);
  });
});

describe("anagrams", () => {
  test("uses exactly the letters, leaving out the input", () =>
    expect(anagrams(list, "stone", 10)).toEqual(["NOTES", "ONSET", "TONES"]));
  test("? is a blank", () =>
    expect(anagrams(list, "CT?", 10)).toEqual(["CAT", "ACT", "TAC", "COT", "CUT"]));
  test("respects the limit", () => expect(anagrams(list, "TCA", 2)).toEqual(["CAT", "ACT"]));
});

test("has finds entries by their letters", () => {
  expect(list.has("NEWYORK")).toBe(true);
  expect(list.has("DOG")).toBe(false);
});
