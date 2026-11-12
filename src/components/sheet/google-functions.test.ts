import {describe, expect, test} from "vite-plus/test";

import {compare, countUnique, flatten, sortN, split} from "./google-functions";
import {a1z26, caesar} from "./puzzle-functions";

describe("SPLIT", () => {
  test("splits on a delimiter", () => expect(split("a,b,c", ",")).toEqual([["a", "b", "c"]]));
  test("splits on each character by default", () =>
    expect(split("a-b c", "- ")).toEqual([["a", "b", "c"]]));
  test("splits on the whole delimiter when asked", () =>
    expect(split("a--b-c", "--", false)).toEqual([["a", "b-c"]]));
  test("keeps empty parts when asked", () =>
    expect(split("a,,b", ",", true, false)).toEqual([["a", "", "b"]]));
  test("numbers come out as numbers", () => expect(split("1,2,x", ",")).toEqual([[1, 2, "x"]]));
});

test("COUNTUNIQUE counts distinct non-blank values", () => {
  expect(
    countUnique(
      flatten([
        [
          ["a", "b"],
          ["a", null],
        ],
        1,
        "1",
      ])
    )
  ).toBe(4);
});

describe("SORTN", () => {
  const data = [
    ["c", 3],
    ["a", 1],
    ["b", 2],
    ["a", 1],
    ["d", 2],
  ];
  test("the first n rows", () =>
    expect(sortN(data, 2, 0, [[2, true]])).toEqual([
      ["a", 1],
      ["a", 1],
    ]));
  test("ties mode 1 adds rows tied with the last", () =>
    expect(sortN(data, 3, 1, [[2, true]])).toEqual([
      ["a", 1],
      ["a", 1],
      ["b", 2],
      ["d", 2],
    ]));
  test("ties mode 2 drops duplicate rows", () =>
    expect(sortN(data, 2, 2, [[2, true]])).toEqual([
      ["a", 1],
      ["b", 2],
    ]));
  test("ties mode 3 keeps duplicates of the first n unique rows", () =>
    expect(sortN(data, 2, 3, [[2, true]])).toEqual([
      ["a", 1],
      ["a", 1],
      ["b", 2],
    ]));
  test("descending", () => expect(sortN(data, 1, 0, [[2, false]])).toEqual([["c", 3]]));
});

test("comparison ignores case, like Google Sheets", () => expect(compare("A", "a")).toBe(0));

describe("puzzle functions", () => {
  test("CAESAR shifts letters and keeps case", () => {
    expect(caesar("Khoor zruog", -3)).toBe("Hello world");
  });
  test("A1Z26 converts both ways", () => {
    expect(a1z26("8 5 12 12 15")).toBe("HELLO");
    expect(a1z26("hello")).toBe("8 5 12 12 15");
  });
});
