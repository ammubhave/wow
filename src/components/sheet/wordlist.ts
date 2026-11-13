import {WORDLIST_URL} from "./wordlist-file";

/**
 * The built-in sheet's word list: ~566k words and phrases (written without spaces, as crosswords
 * do), best-scored first. Downloaded (~2.4 MB, cached by the browser for good) the first time a
 * word formula is used, then kept for the page's life.
 */
export type WordList = {
  /** Every entry, best first. */
  words: string[];
  /** Entries by length, best first. */
  byLength: Map<number, string[]>;
  has: (word: string) => boolean;
};

/** Letters only, in capitals: how entries are written (NEW YORK → NEWYORK). */
export const letters = (text: string) => text.toUpperCase().replace(/[^A-Z]/g, "");

export function buildWordList(text: string): WordList {
  const words = text.split("\n").filter(Boolean);
  const byLength = new Map<number, string[]>();
  for (const word of words) {
    const list = byLength.get(word.length);
    if (list) list.push(word);
    else byLength.set(word.length, [word]);
  }
  const set = new Set(words);
  return {words, byLength, has: word => set.has(word)};
}

const VOWELS = "AEIOU";
const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";

/**
 * A pattern as a regular expression, or null if it isn't one. `?`, `.` or `_` is any one letter,
 * `*` any run of letters (or none), `@` a vowel, `#` a consonant, `[ABC]` one of those letters;
 * other letters stand for themselves and anything else (spaces, hyphens) is ignored. Also the
 * pattern's length when it has no `*`.
 */
export function compilePattern(pattern: string): {regex: RegExp; length: number | null} | null {
  let source = "";
  let length = 0;
  let fixed = true;
  const upper = pattern.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]!;
    if (/[A-Z]/.test(ch)) source += ch;
    else if (ch === "?" || ch === "." || ch === "_") source += "[A-Z]";
    else if (ch === "@") source += `[${VOWELS}]`;
    else if (ch === "#") source += `[${CONSONANTS}]`;
    else if (ch === "*") {
      source += "[A-Z]*";
      fixed = false;
      continue;
    } else if (ch === "[") {
      const end = upper.indexOf("]", i);
      const set = end > i ? letters(upper.slice(i + 1, end)) : "";
      if (!set) return null;
      source += `[${set}]`;
      i = end;
    } else continue;
    length++;
  }
  if (!source) return null;
  return {regex: new RegExp(`^${source}$`), length: fixed ? length : null};
}

/** Entries matching a pattern (see compilePattern), best first, at most `limit`. */
export function matches(list: WordList, pattern: string, limit: number): string[] {
  const compiled = compilePattern(pattern);
  if (!compiled) return [];
  const pool = compiled.length === null ? list.words : (list.byLength.get(compiled.length) ?? []);
  const out: string[] = [];
  for (const word of pool) {
    if (compiled.regex.test(word)) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
}

const counts = (word: string) => {
  const c = Array.from({length: 26}, () => 0);
  for (let i = 0; i < word.length; i++) c[word.charCodeAt(i) - 65]!++;
  return c;
};

/**
 * Entries that use exactly these letters, best first, at most `limit`. Each `?` is a blank
 * (any letter). The letters themselves aren't listed.
 */
export function anagrams(list: WordList, input: string, limit: number): string[] {
  const known = letters(input);
  const blanks = (input.match(/\?/g) ?? []).length;
  const length = known.length + blanks;
  if (length === 0) return [];
  const need = counts(known);
  const out: string[] = [];
  for (const word of list.byLength.get(length) ?? []) {
    if (word === known) continue;
    const have = counts(word);
    let spare = blanks;
    let ok = true;
    for (let i = 0; i < 26 && ok; i++) {
      const missing = need[i]! - have[i]!;
      // The word lacks a letter we have: impossible. It has extra letters: blanks cover them.
      if (missing > 0) ok = false;
      else if (missing < 0) {
        spare += missing;
        if (spare < 0) ok = false;
      }
    }
    if (ok) {
      out.push(word);
      if (out.length >= limit) break;
    }
  }
  return out;
}

let loading: Promise<WordList> | undefined;

/** The word list, downloading it the first time. */
export function loadWordList(): Promise<WordList> {
  loading ??= (async () => {
    const response = await fetch(WORDLIST_URL);
    if (!response.ok) throw new Error(`Word list: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Gzipped, unless something on the way already unpacked it.
    const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
    const text = gzipped
      ? await new Response(
          new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
        ).text()
      : new TextDecoder().decode(bytes);
    return buildWordList(text);
  })().catch((error: unknown) => {
    // Try again next time.
    loading = undefined;
    throw error;
  });
  return loading;
}
