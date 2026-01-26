import {SignalIcon, SignalMediumIcon, SignalZeroIcon} from "lucide-react";

const puzzleImportances = [
  {
    value: "important",
    label: "Important",
    icon: <SignalIcon />,
    smallIcon: <SignalIcon className="py-1 inline" />,
    color: "bg-cyan-600 dark:bg-cyan-400",
  },
  {
    value: "normal",
    label: "Normal",
    icon: <SignalMediumIcon />,
    smallIcon: <SignalMediumIcon className="py-1 inline" />,
    color: "bg-cyan-400 dark:bg-cyan-600",
  },
  {
    value: "obsolete",
    label: "Obsolete",
    icon: <SignalZeroIcon />,
    smallIcon: <SignalZeroIcon className="py-1 inline" />,
    color: "bg-cyan-100 dark:bg-cyan-900",
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
  return getPuzzleImportance(importance) ?? getPuzzleImportance("normal")!.color;
}
