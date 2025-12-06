import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBgColorClassNamesForPuzzleStatus(status: string | null) {
  return status === "solved" || status === "backsolved" || status === "obsolete"
    ? "bg-green-100 hover:bg-green-100/50 dark:bg-green-950 dark:hover:bg-green-950/50"
    : status === "needs_eyes" || status === "extraction"
      ? "bg-yellow-100 hover:bg-yellow-100/50 dark:bg-yellow-950 dark:hover:bg-yellow-950/50"
      : status === "stuck" || status === "pending" || status === "very_stuck"
        ? "bg-red-100 hover:bg-red-100/50 dark:bg-red-950 dark:hover:bg-red-950/50"
        : undefined;
}
