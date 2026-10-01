import {SignalIcon, SignalHighIcon, SignalMediumIcon} from "lucide-react";

const puzzleImportances = [
  {
    value: "important",
    label: "Important",
    icon: <SignalIcon />,
    smallIcon: <SignalIcon className="inline py-1" />,
    // Theme tokens: important stands out (accent), normal is the neutral fill, obsolete fades.
    color: "bg-accent-soft text-accent-soft-foreground",
  },
  {
    value: "normal",
    label: "Normal",
    icon: <SignalHighIcon />,
    smallIcon: <SignalHighIcon className="inline py-1" />,
    color: "bg-default text-default-foreground",
  },
  {
    value: "obsolete",
    label: "Obsolete",
    icon: <SignalMediumIcon />,
    smallIcon: <SignalMediumIcon className="inline py-1" />,
    color: "text-muted",
  },
];

export function getPuzzleImportances() {
  return puzzleImportances;
}

export function getPuzzleImportance(importance: string | null) {
  for (const imp of puzzleImportances) {
    if (imp.value === importance) {
      return imp;
    }
  }
  return null;
}

/** Cell colors for an importance; unset gets none (the board shows a ghost "Normal" icon). */
export function getColorClassNamesForPuzzleImportances(importance: string | null) {
  return getPuzzleImportance(importance)?.color ?? "";
}
