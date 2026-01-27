import {SignalIcon, SignalHighIcon, SignalMediumIcon} from "lucide-react";

const puzzleImportances = [
  {
    value: "important",
    label: "Important",
    icon: <SignalIcon />,
    smallIcon: <SignalIcon className="py-1 inline" />,
    color: "bg-slate-500 dark:bg-slate-500",
  },
  {
    value: "normal",
    label: "Normal",
    icon: <SignalHighIcon />,
    smallIcon: <SignalHighIcon className="py-1 inline" />,
    color: "bg-slate-300 dark:bg-slate-800",
  },
  {
    value: "obsolete",
    label: "Obsolete",
    icon: <SignalMediumIcon />,
    smallIcon: <SignalMediumIcon className="py-1 inline" />,
    color: "bg-slate-50 dark:bg-slate-950",
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

export function getColorClassNamesForPuzzleImportances(importance: string | null) {
  return getPuzzleImportance(importance)?.color ?? getPuzzleImportance("normal")!.color;
}
