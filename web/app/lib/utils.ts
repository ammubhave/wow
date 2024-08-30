import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBgColorClassNamesForPuzzleStatus(status: string | null) {
  return status === "solved" || status === "backsolved" || status === "obsolete"
    ? "bg-green-100 hover:bg-green-100/50"
    : status === "needs_eyes" || status === "extraction"
      ? "bg-yellow-100 hover:bg-yellow-100/50"
      : status === "stuck" || status === "pending" || status === "very_stuck"
        ? "bg-red-100 hover:bg-red-100/50"
        : undefined;
}
