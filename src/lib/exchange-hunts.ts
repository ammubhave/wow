// Shared by the Puzzle Exchange pages: which month a hunt is for, and how it's labelled.

type HuntLike = {id: string; name: string; createdAt: Date | string; draft: boolean};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/**
 * The month a hunt is for: from its name when it reads like "March 2026" (hunts are usually
 * created a few days before their month starts), otherwise when it was created.
 */
export function huntDate(hunt: Pick<HuntLike, "name" | "createdAt">) {
  const match = /^([a-z]+)\s+(\d{4})$/i.exec(hunt.name.trim());
  const month = match ? MONTHS.indexOf(match[1]!.toLowerCase()) : -1;
  return match && month >= 0 ? new Date(Number(match[2]), month, 1) : new Date(hunt.createdAt);
}

/** Newest month first. */
export function sortHunts<T extends Pick<HuntLike, "name" | "createdAt">>(hunts: T[]) {
  return hunts.toSorted((a, b) => huntDate(b).getTime() - huntDate(a).getTime());
}

/** "September 2026" → month and year shown at different weights; other names as they are. */
export function splitHuntName(name: string) {
  const match = /^(.*\S)\s+(\d{4})$/.exec(name);
  return match ? {title: match[1]!, year: match[2]} : {title: name, year: undefined};
}

/** Published hunts numbered like magazine issues, oldest first: No. 1, No. 2, … */
export function issueNumbers(hunts: HuntLike[]) {
  const published = sortHunts(hunts.filter(hunt => !hunt.draft)).toReversed();
  return new Map(published.map((hunt, i) => [hunt.id, i + 1]));
}
