import type {FUniver} from "@univerjs/presets";

/**
 * Google Sheets functions that Univer doesn't have, so formulas copied from (or typed out of
 * habit for) Google Sheets work in the built-in sheet. Univer covers 482 of Google's 514
 * functions; these fill in the rest that don't need the internet (IMPORTHTML, GOOGLETRANSLATE…),
 * a query language (QUERY) or a chart (SPARKLINE).
 *
 * Univer passes each argument as a value, or a range as rows of values (empty cells are null), and
 * spills a returned 2-D array into the cells around the formula, as Google Sheets does.
 */

export type Value = string | number | boolean | null;
export type Matrix = Value[][];

export const isMatrix = (arg: unknown): arg is Matrix =>
  Array.isArray(arg) && arg.every(Array.isArray);

/** A value from an argument (a range's first cell). */
export function scalar(arg: unknown): Value {
  if (isMatrix(arg)) return scalar(arg[0]?.[0] ?? null);
  return typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean"
    ? arg
    : null;
}

/** Every value of every argument, ranges row by row. */
export function flatten(args: unknown[]): Value[] {
  return args.flatMap(arg => (isMatrix(arg) ? arg.flat() : [scalar(arg)]));
}

/** Google's numeric reading of a value: blank is 0, TRUE is 1, numeric text is its number. */
export function toNumber(value: Value): number {
  if (value === null || value === "") return 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  return typeof value === "number" ? value : Number(value);
}

export const toText = (value: Value) =>
  value === null ? "" : typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : String(value);

/** Applies `fn` to every cell (when given a range) or to the value, like Google's operators. */
export function elementwise(
  a: unknown,
  b: unknown,
  fn: (x: Value, y: Value) => Value
): Value | Matrix {
  if (isMatrix(a) || isMatrix(b)) {
    const rows = Math.max(isMatrix(a) ? a.length : 1, isMatrix(b) ? b.length : 1);
    const cols = Math.max(
      isMatrix(a) ? (a[0]?.length ?? 1) : 1,
      isMatrix(b) ? (b[0]?.length ?? 1) : 1
    );
    const at = (m: unknown, r: number, c: number) =>
      isMatrix(m)
        ? (m[Math.min(r, m.length - 1)]?.[Math.min(c, (m[0]?.length ?? 1) - 1)] ?? null)
        : scalar(m);
    return Array.from({length: rows}, (_row, r) =>
      Array.from({length: cols}, (_col, c) => fn(at(a, r, c), at(b, r, c)))
    );
  }
  return fn(scalar(a), scalar(b));
}

/** Google's comparison: numbers by value, text case-insensitively, blank like 0 or "". */
export function compare(a: Value, b: Value): number {
  const kind = (v: Value) => (v === null ? "blank" : typeof v);
  if (kind(a) === "blank" && kind(b) === "blank") return 0;
  if (typeof a === "string" || typeof b === "string") {
    if (typeof a === "number" || typeof b === "number") return typeof a === "number" ? -1 : 1;
    return toText(a).toLowerCase().localeCompare(toText(b).toLowerCase());
  }
  return toNumber(a) - toNumber(b);
}

/** SPLIT(text, delimiter, [split_by_each = TRUE], [remove_empty_text = TRUE]). */
export function split(text: string, delimiter: string, byEach = true, removeEmpty = true): Matrix {
  if (delimiter === "") return [[text]];
  let parts: string[];
  if (byEach) {
    const escaped = [...new Set(delimiter)].map(ch => ch.replace(/[\\^$.*+?()[\]{}|-]/g, "\\$&"));
    parts = text.split(new RegExp(`[${escaped.join("")}]`));
  } else {
    parts = text.split(delimiter);
  }
  if (removeEmpty) parts = parts.filter(part => part !== "");
  // Numbers come out as numbers, as in Google Sheets.
  return [
    parts.map(part => (part.trim() !== "" && !Number.isNaN(Number(part)) ? Number(part) : part)),
  ];
}

/** COUNTUNIQUE(value1, [value2, ...]): distinct non-blank values (text case-sensitively). */
export function countUnique(values: Value[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (value === null || value === "") continue;
    seen.add(`${typeof value}:${String(value)}`);
  }
  return seen.size;
}

/** Whether two rows hold the same values (as Google compares them). */
const sameRow = (a: Value[], b: Value[]) =>
  a.length === b.length && a.every((v, i) => compare(v, b[i] ?? null) === 0);

/**
 * SORTN(range, [n = 1], [display_ties_mode = 0], [sort_column = 1], [is_ascending = TRUE], ...):
 * the first n rows after sorting. Ties modes: 0 exactly n rows; 1 n rows plus any tied with the
 * last; 2 n rows, dropping duplicates of earlier rows; 3 the first n unique rows plus all their
 * duplicates.
 */
export function sortN(range: Matrix, n = 1, tiesMode = 0, keys: [number, boolean][] = [[1, true]]) {
  const rows = range.filter(row => row.some(v => v !== null && v !== ""));
  const order = (a: Value[], b: Value[]) => {
    for (const [col, ascending] of keys) {
      const diff = compare(a[col - 1] ?? null, b[col - 1] ?? null);
      if (diff !== 0) return ascending ? diff : -diff;
    }
    return 0;
  };
  const sorted = rows.toSorted(order);
  const sameKeys = (a: Value[], b: Value[]) => order(a, b) === 0;
  switch (tiesMode) {
    case 1: {
      const head = sorted.slice(0, n);
      const last = head.at(-1);
      return last ? [...head, ...sorted.slice(n).filter(row => sameKeys(row, last))] : head;
    }
    case 2: {
      const unique: Value[][] = [];
      for (const row of sorted) {
        if (!unique.some(u => sameRow(u, row))) unique.push(row);
        if (unique.length === n) break;
      }
      return unique;
    }
    case 3: {
      const unique: Value[][] = [];
      for (const row of sorted) {
        if (!unique.some(u => sameRow(u, row))) unique.push(row);
      }
      const chosen = unique.slice(0, n);
      return sorted.filter(row => chosen.some(u => sameRow(u, row)));
    }
    default:
      return sorted.slice(0, n);
  }
}

/** Univer's own error values, as text (custom functions can only return plain values). */
const DIV0 = "#DIV/0!";
const NUM = "#NUM!";

const arithmetic = (fn: (x: number, y: number) => number | string) => (a: unknown, b: unknown) =>
  elementwise(a, b, (x, y) => fn(toNumber(x), toNumber(y)));
const comparison = (fn: (diff: number) => boolean) => (a: unknown, b: unknown) =>
  elementwise(a, b, (x, y) => fn(compare(x, y)));
const unary = (fn: (x: number) => number) => (a: unknown) =>
  elementwise(a, null, x => fn(toNumber(x)));

const FUNCTIONS: [name: string, fn: (...args: unknown[]) => unknown, description: string][] = [
  // Google's operator functions (what =A1+B1 and friends are called in Google Sheets).
  ["ADD", arithmetic((x, y) => x + y), "Returns the sum of two numbers: =ADD(A1, B1)"],
  [
    "DIVIDE",
    arithmetic((x, y) => (y === 0 ? DIV0 : x / y)),
    "Divides one number by another: =DIVIDE(A1, B1)",
  ],
  ["POW", arithmetic((x, y) => x ** y), "Raises a number to a power: =POW(2, 10)"],
  ["EQ", comparison(d => d === 0), "TRUE if two values are equal: =EQ(A1, B1)"],
  ["NE", comparison(d => d !== 0), "TRUE if two values differ: =NE(A1, B1)"],
  ["GT", comparison(d => d > 0), "TRUE if the first value is greater: =GT(A1, B1)"],
  ["GTE", comparison(d => d >= 0), "TRUE if the first value is greater or equal: =GTE(A1, B1)"],
  ["LT", comparison(d => d < 0), "TRUE if the first value is less: =LT(A1, B1)"],
  ["LTE", comparison(d => d <= 0), "TRUE if the first value is less or equal: =LTE(A1, B1)"],
  ["UMINUS", unary(x => -x), "Returns a number with its sign flipped: =UMINUS(A1)"],
  [
    "UPLUS",
    (a: unknown) => (isMatrix(a) ? a : scalar(a)),
    "Returns its argument unchanged: =UPLUS(A1)",
  ],
  ["UNARY_PERCENT", unary(x => x / 100), "Divides a number by 100: =UNARY_PERCENT(50)"],
  // Univer computes arrays wherever Google needs ARRAYFORMULA, so it just passes them through.
  [
    "ARRAYFORMULA",
    (a: unknown) => (isMatrix(a) ? a : scalar(a)),
    "Shows the values of an array formula across cells: =ARRAYFORMULA(A1:A10 * 2)",
  ],
  [
    "ISO.CEILING",
    (value: unknown, significance: unknown = 1) => {
      const x = toNumber(scalar(value));
      const s = Math.abs(toNumber(scalar(significance)));
      return s === 0 ? 0 : Math.ceil(x / s) * s;
    },
    "Rounds a number up to the nearest multiple: =ISO.CEILING(4.3, 2)",
  ],
  [
    "JOIN",
    (delimiter: unknown, ...values: unknown[]) =>
      flatten(values)
        .map(toText)
        .join(toText(scalar(delimiter))),
    'Joins values with a delimiter: =JOIN(", ", A1:A5)',
  ],
  [
    "SPLIT",
    (text: unknown, delimiter: unknown, byEach: unknown = true, removeEmpty: unknown = true) =>
      split(
        toText(scalar(text)),
        toText(scalar(delimiter)),
        scalar(byEach) !== false,
        scalar(removeEmpty) !== false
      ),
    'Splits text into cells: =SPLIT("a,b,c", ",")',
  ],
  [
    "COUNTUNIQUE",
    (...values: unknown[]) => countUnique(flatten(values)),
    "Counts the distinct values: =COUNTUNIQUE(A1:A20)",
  ],
  [
    "SORTN",
    (range: unknown, n: unknown = 1, ties: unknown = 0, ...sorts: unknown[]) => {
      const keys: [number, boolean][] = [];
      for (let i = 0; i < sorts.length; i += 2) {
        keys.push([toNumber(scalar(sorts[i] ?? 1)), scalar(sorts[i + 1] ?? true) !== false]);
      }
      const rows = sortN(
        isMatrix(range) ? range : [[scalar(range)]],
        toNumber(scalar(n)),
        toNumber(scalar(ties)),
        keys.length > 0 ? keys : [[1, true]]
      );
      return rows.length > 0 ? rows : "#N/A";
    },
    "The first n rows of a range after sorting: =SORTN(A2:C20, 3, 0, 2, FALSE)",
  ],
  // Google's TO_* functions set a display format, which a function can't do here: they return
  // the value, which is what other formulas see anyway.
  ["TO_TEXT", (a: unknown) => toText(scalar(a)), "Converts a value to text: =TO_TEXT(A1)"],
  [
    "TO_PURE_NUMBER",
    (a: unknown) => {
      const n = toNumber(scalar(a));
      return Number.isNaN(n) ? NUM : n;
    },
    "Converts a value to a plain number: =TO_PURE_NUMBER(A1)",
  ],
  [
    "TO_PERCENT",
    (a: unknown) => toNumber(scalar(a)),
    "Converts a value to a percentage: =TO_PERCENT(0.5)",
  ],
  [
    "TO_DOLLARS",
    (a: unknown) => toNumber(scalar(a)),
    "Converts a value to dollars: =TO_DOLLARS(A1)",
  ],
];

/** Registers the missing Google Sheets functions with a sheet's formula engine. */
export function registerGoogleFunctions(univerAPI: FUniver) {
  const formula = univerAPI.getFormula();
  for (const [name, fn, description] of FUNCTIONS) {
    formula.registerFunction(
      name,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Univer passes values or rows of values, and accepts either back.
      fn as Parameters<typeof formula.registerFunction>[1],
      description
    );
  }
}
