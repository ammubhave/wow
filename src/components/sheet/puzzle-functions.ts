import type {FUniver} from "@univerjs/presets";

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
  ];
  return {dispose: () => registered.forEach(r => r.dispose())};
}
