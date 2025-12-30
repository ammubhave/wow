const puzzleStatuses = [
  {
    groupLabel: "Active",
    values: [
      {value: null, label: "None"},
      {value: "active", label: "Active"},
    ],
  },
  {
    groupLabel: "Solved",
    bgColor: "bg-green-100 hover:bg-green-100/50 dark:bg-green-950 dark:hover:bg-green-950/50",
    bgColorNoHover: "bg-green-100 dark:bg-green-950",
    values: [
      {value: "solved", label: "Solved"},
      {value: "backsolved", label: "Backsolved"},
    ],
  },
  {
    groupLabel: "Warning",
    bgColor: "bg-yellow-100 hover:bg-yellow-100/50 dark:bg-yellow-950 dark:hover:bg-yellow-950/50",
    bgColorNoHover: "bg-yellow-100 dark:bg-yellow-950",
    values: [
      {value: "needs_eyes", label: "Needs Eyes"},
      {value: "extraction", label: "Extraction"},
    ],
  },
  {
    groupLabel: "Stuck",
    bgColor: "bg-red-100 hover:bg-red-100/50 dark:bg-red-950 dark:hover:bg-red-950/50",
    bgColorNoHover: "bg-red-100 dark:bg-red-950",
    values: [
      {value: "stuck", label: "Stuck"},
      {value: "pending", label: "Pending"},
      {value: "very_stuck", label: "Very Stuck"},
    ],
  },
];

export function getPuzzleStatusOptions() {
  return puzzleStatuses.flatMap(group => group.values);
}

function findStatusGroup(status: string | null) {
  for (const group of puzzleStatuses) {
    if (group.values.some(v => v.value === status)) {
      return group;
    }
  }
  return null;
}

export function getBgColorClassNamesForPuzzleStatus(status: string | null) {
  const group = findStatusGroup(status);
  if (group) {
    return group.bgColor;
  }
  return undefined;
}

export function getBgColorClassNamesForPuzzleStatusNoHover(status: string | null) {
  const group = findStatusGroup(status);
  if (group) {
    return group.bgColorNoHover;
  }
  return undefined;
}
