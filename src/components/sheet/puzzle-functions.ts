import type {FUniver} from "@univerjs/presets";

import {elementwise, type Matrix, toNumber, toText} from "./google-functions";
import {anagrams, letters, loadWordList, matches} from "./wordlist";

/** A formula argument: a value, or a range (rows of values); a range uses its first cell. */
function scalar(value: unknown): unknown {
  if (Array.isArray(value)) return scalar(value[0]);
  return value;
}

const text = (value: unknown) => {
  const v = scalar(value);
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "";
};

/** Shifts letters by `shift` places (case kept, other characters untouched). */
export function caesar(input: string, shift: number) {
  const k = ((Math.trunc(shift) % 26) + 26) % 26;
  return input.replace(/[a-z]/gi, ch => {
    const base = ch <= "Z" ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26) + base);
  });
}

/** Numbers to letters (1 → A, 27 wraps to A), or letters to numbers, space-separated. */
export function a1z26(input: string) {
  const trimmed = input.trim();
  if (/^[\d\s,.-]+$/.test(trimmed)) {
    return trimmed
      .split(/[\s,.-]+/)
      .filter(Boolean)
      .map(n => String.fromCharCode(((((Number(n) - 1) % 26) + 26) % 26) + 65))
      .join("");
  }
  return trimmed
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map(ch => ch.charCodeAt(0) - 64)
    .join(" ");
}

/** Every shift of the alphabet (1 to 25), one per row: the shift, then the shifted text. */
export function caesarAll(input: string): Matrix {
  return Array.from({length: 25}, (_, i) => [i + 1, caesar(input, i + 1)]);
}

/**
 * The nth letter of the text, counting letters only (spaces, digits and punctuation are skipped,
 * as in puzzle extraction); a negative n counts from the end. Blank when there's no such letter.
 */
export function nth(input: string, n: number) {
  const chars = input.match(/\p{L}/gu) ?? [];
  const index = Math.trunc(n);
  if (!Number.isFinite(index) || index === 0) return "";
  return chars.at(index > 0 ? index - 1 : index) ?? "";
}

const MORSE_CODES: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
};
const MORSE_LETTERS = Object.fromEntries(Object.entries(MORSE_CODES).map(([k, v]) => [v, k]));

// The ways people write a dit (. · • ∙ ⋅ *) and a dah (- − – — ‒ _).
const DITS = /[.·•∙⋅*]/g;
const DAHS = /[-−–—‒_]/g;

/**
 * Morse both ways. Input that's only dits, dahs, spaces and word breaks is decoded (letters split
 * by spaces, words by "/", "|" or two or more spaces; an unknown code reads as "?"); anything else
 * is encoded, letters split by spaces and words by " / ".
 */
export function morse(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[.·•∙⋅*\-−–—‒_\s/|]+$/.test(trimmed)) {
    return trimmed
      .replace(DITS, ".")
      .replace(DAHS, "-")
      .split(/\s*[/|]\s*|\s{2,}/)
      .map(word =>
        word
          .split(/\s+/)
          .filter(Boolean)
          .map(code => MORSE_LETTERS[code] ?? "?")
          .join("")
      )
      .filter(Boolean)
      .join(" ");
  }
  return trimmed
    .toUpperCase()
    .split(/\s+/)
    .map(word =>
      word
        .split("")
        .map(ch => MORSE_CODES[ch])
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join(" / ");
}

/** Results down a column, or a note when there are none. */
const column = (words: string[]): Matrix | string =>
  words.length > 0 ? words.map(word => [word]) : "No matches";

/** How many results a lookup lists: 50 unless asked, at most 1000. */
const resultLimit = (limit: unknown) => {
  const n = Math.trunc(Number(scalar(limit)));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 50;
};

/** Puzzle-solving formulas available in every built-in sheet. */
export function registerPuzzleFunctions(univerAPI: FUniver) {
  const formula = univerAPI.getFormula();
  const registered = [
    formula.registerFunction(
      "CAESAR",
      (value: unknown, shift: unknown) => caesar(text(value), Number(scalar(shift) ?? 0) || 0),
      "Shifts each letter by a number of places: =CAESAR(A1, 3)"
    ),
    formula.registerFunction(
      "A1Z26",
      (value: unknown) => a1z26(text(value)),
      "Converts numbers to letters (1 = A) or letters to numbers: =A1Z26(A1)"
    ),
    formula.registerFunction(
      "CAESARALL",
      (value: unknown) => (text(value) ? caesarAll(text(value)) : ""),
      "Lists all 25 shifts of the text, one per row: =CAESARALL(A1)"
    ),
    formula.registerFunction(
      "NTH",
      // Ranges work cell by cell (=NTH(A1:A10, B1:B10) extracts a letter from each row).
      (value: unknown, n: unknown) =>
        elementwise(value, n, (word, index) => nth(toText(word), toNumber(index))),
      "The nth letter, skipping spaces, digits and punctuation (negative counts from the end): =NTH(A1, 3)"
    ),
    formula.registerFunction(
      "MORSE",
      (value: unknown) => morse(text(value)),
      "Decodes Morse (. or · for dit, - or _ for dah; / between words) or encodes text: =MORSE(A1)"
    ),
  ];
  // Word-list lookups: async, since the list is downloaded the first time one is used.
  registered.push(
    formula.registerAsyncFunction(
      "MATCHES",
      async (pattern: unknown, limit: unknown) =>
        column(matches(await loadWordList(), text(pattern), resultLimit(limit))),
      'Words and phrases fitting a pattern, best first (? any letter, * any run, @ vowel, # consonant): =MATCHES("C?T")'
    ),
    formula.registerAsyncFunction(
      "ANAGRAMS",
      async (value: unknown, limit: unknown) =>
        column(anagrams(await loadWordList(), text(value), resultLimit(limit))),
      "Words and phrases using exactly these letters, best first (? is a blank): =ANAGRAMS(A1)"
    ),
    formula.registerAsyncFunction(
      "ISWORD",
      async (value: unknown) => {
        const word = letters(text(value));
        return word ? (await loadWordList()).has(word) : false;
      },
      "TRUE if the text is a word or phrase in the word list (spaces ignored): =ISWORD(A1)"
    )
  );
  return {dispose: () => registered.forEach(r => r.dispose())};
}
