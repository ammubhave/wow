/**
 * WOW's puzzle formulas, described for people: the one list behind the built-in sheet's Puzzle
 * tools dialog and the docs' formula reference, so the two always agree. Each example is
 * self-contained (no cell references), so it works wherever it's inserted.
 */

export type FormulaDoc = {
  name: string;
  /** How it's called, optional arguments in brackets. */
  signature: string;
  /** What it does (one or two sentences). */
  what: string;
  example: string;
  /** What the example gives. */
  gives: string;
  /** More detail for the reference: argument meanings, edge cases. */
  details?: string[];
};

export const PUZZLE_FORMULA_GROUPS: {title: string; formulas: FormulaDoc[]}[] = [
  {
    title: "Words",
    formulas: [
      {
        name: "MATCHES",
        signature: "MATCHES(pattern, [how_many])",
        what: "Words and phrases fitting a pattern, best first. ? is any letter, * any run, @ a vowel, # a consonant. An optional second argument sets how many (50 by default).",
        example: '=MATCHES("C?OSS?ORD")',
        gives: "CROSSWORD",
        details: [
          "Pattern letters: ? (or . or _) is any one letter, * any run of letters (or none), @ a vowel, # a consonant, [ABC] one of those letters. Other letters match themselves; spaces and hyphens are ignored.",
          "Results go down the column, one per row, most common first. how_many is 50 unless set, at most 1000.",
          "Phrases are written without spaces, as crosswords do (ICECREAMBAR).",
        ],
      },
      {
        name: "ANAGRAMS",
        signature: "ANAGRAMS(letters, [how_many])",
        what: "Words and phrases using exactly these letters, best first. ? is a blank.",
        example: '=ANAGRAMS("SILENT")',
        gives: "ENLIST, INLETS, LISTEN…",
        details: [
          "Each ? stands for any one letter (a blank tile).",
          "Results go down the column; how_many is 50 unless set, at most 1000.",
        ],
      },
      {
        name: "ISWORD",
        signature: "ISWORD(text)",
        what: "TRUE if the text is a word or phrase in the word list (spaces are ignored).",
        example: '=ISWORD("ICE CREAM")',
        gives: "TRUE",
      },
    ],
  },
  {
    title: "Ciphers",
    formulas: [
      {
        name: "CAESAR",
        signature: "CAESAR(text, shift)",
        what: "Shifts each letter by a number of places.",
        example: '=CAESAR("HAL", 1)',
        gives: "IBM",
        details: [
          "Keeps upper and lower case; anything that isn't a letter is left alone. A negative shift goes backwards.",
        ],
      },
      {
        name: "CAESARALL",
        signature: "CAESARALL(text)",
        what: "All 25 shifts, one per row, to scan for the one that reads.",
        example: '=CAESARALL("URYYB")',
        gives: "13 → HELLO, among others",
        details: ["Two columns: the shift (1 to 25), then the shifted text."],
      },
      {
        name: "A1Z26",
        signature: "A1Z26(text)",
        what: "Numbers to letters (1 = A), or letters to numbers.",
        example: '=A1Z26("8 9")',
        gives: "HI",
        details: [
          "Numbers can be separated by spaces, commas, dots or dashes; 27 wraps round to A. Letters come back as numbers separated by spaces.",
        ],
      },
      {
        name: "MORSE",
        signature: "MORSE(text)",
        what: "Decodes Morse (. or · for dit, - or _ for dah, / between words), or encodes text.",
        example: '=MORSE("... --- ...")',
        gives: "SOS",
        details: [
          "Decoding: letters are separated by spaces, words by /, | or two or more spaces. Dits can be . · • ∙ ⋅ or *, dahs - − – — ‒ or _. An unknown code reads as ?.",
          "Anything else is encoded: letters separated by spaces, words by /.",
        ],
      },
    ],
  },
  {
    title: "Extraction",
    formulas: [
      {
        name: "NTH",
        signature: "NTH(text, n)",
        what: "The nth letter, skipping spaces, digits and punctuation; negative counts from the end. Works down a range: =NTH(A1:A10, B1:B10).",
        example: '=NTH("Puzzle hunt", 7)',
        gives: "h",
        details: [
          "Counts letters only, as puzzle extraction does. Blank when there's no such letter.",
          "Given ranges, it works row by row: =NTH(A1:A10, B1:B10) takes a letter from each row.",
        ],
      },
    ],
  },
];

/**
 * Google Sheets functions the built-in sheet adds (Univer, which it's built on, has most of the
 * rest), so formulas copied from Google Sheets work. Kept in step with google-functions.ts.
 */
export const GOOGLE_FORMULAS: {name: string; signature: string; what: string}[] = [
  {name: "ADD", signature: "ADD(a, b)", what: "The sum of two numbers."},
  {name: "DIVIDE", signature: "DIVIDE(a, b)", what: "One number divided by another."},
  {name: "POW", signature: "POW(base, exponent)", what: "A number raised to a power."},
  {name: "EQ", signature: "EQ(a, b)", what: "TRUE if two values are equal."},
  {name: "NE", signature: "NE(a, b)", what: "TRUE if two values differ."},
  {name: "GT", signature: "GT(a, b)", what: "TRUE if the first is greater."},
  {name: "GTE", signature: "GTE(a, b)", what: "TRUE if the first is greater or equal."},
  {name: "LT", signature: "LT(a, b)", what: "TRUE if the first is less."},
  {name: "LTE", signature: "LTE(a, b)", what: "TRUE if the first is less or equal."},
  {name: "UMINUS", signature: "UMINUS(value)", what: "A number with its sign flipped."},
  {name: "UPLUS", signature: "UPLUS(value)", what: "Its argument, unchanged."},
  {name: "UNARY_PERCENT", signature: "UNARY_PERCENT(value)", what: "A number divided by 100."},
  {
    name: "ARRAYFORMULA",
    signature: "ARRAYFORMULA(formula)",
    what: "An array formula's values across cells (arrays work anywhere here, so it just passes them through).",
  },
  {
    name: "ISO.CEILING",
    signature: "ISO.CEILING(value, [significance])",
    what: "Rounds a number up to the nearest multiple.",
  },
  {name: "JOIN", signature: "JOIN(delimiter, values…)", what: "Values joined with a delimiter."},
  {
    name: "SPLIT",
    signature: "SPLIT(text, delimiter, [split_by_each], [remove_empty])",
    what: "Text split into cells.",
  },
  {name: "COUNTUNIQUE", signature: "COUNTUNIQUE(values…)", what: "How many distinct values."},
  {
    name: "SORTN",
    signature: "SORTN(range, [n], [ties_mode], [sort_column, is_ascending]…)",
    what: "The first n rows of a range after sorting.",
  },
  {name: "TO_TEXT", signature: "TO_TEXT(value)", what: "A value as text."},
  {name: "TO_PURE_NUMBER", signature: "TO_PURE_NUMBER(value)", what: "A value as a plain number."},
  {name: "TO_PERCENT", signature: "TO_PERCENT(value)", what: "A value as a percentage."},
  {name: "TO_DOLLARS", signature: "TO_DOLLARS(value)", what: "A value as dollars."},
];
