/**
 * A colour per calendar month, so each Puzzle Exchange month has its own identity (like a magazine
 * issue's cover). Seasonal, and spread around the colour wheel so neighbouring months differ.
 * Each is [light, mid, deep]: the cover gradient uses all three, dots use the middle one.
 */
const MONTH_COLORS: [string, string, string][] = [
  ["#e0f2fe", "#38bdf8", "#0c4a6e"], // January: ice
  ["#fecdd3", "#e11d48", "#4c0519"], // February: rose
  ["#d9f99d", "#65a30d", "#1a2e05"], // March: new leaves
  ["#fbcfe8", "#c026d3", "#3b0764"], // April: blossom
  ["#ddd6fe", "#7c3aed", "#2e1065"], // May: lilac
  ["#fef3c7", "#f59e0b", "#451a03"], // June: sun
  ["#ccfbf1", "#0d9488", "#042f2e"], // July: sea
  ["#fed7aa", "#ea580c", "#431407"], // August: sunset
  ["#c7d2fe", "#4f46e5", "#1e1b4b"], // September: dusk
  ["#fdba74", "#9333ea", "#170b2e"], // October: pumpkin and night
  ["#fecaca", "#b91c1c", "#2a0606"], // November: embers
  ["#bbf7d0", "#047857", "#022c22"], // December: pine
];

export function monthColors(date: Date | string | number) {
  return MONTH_COLORS[new Date(date).getMonth()]!;
}
