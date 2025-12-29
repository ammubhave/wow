export function PuzzleStatusOptions() {
  return [
    {value: null, label: "None"},
    {value: "active", label: "Active"},
    {value: "solved", label: "Solved"},
    {value: "backsolved", label: "Backsolved"},
    {value: "needs_eyes", label: "Needs Eyes"},
    {value: "extraction", label: "Extraction"},
    {value: "stuck", label: "Stuck"},
    {value: "pending", label: "Pending"},
    {value: "very_stuck", label: "Very Stuck"},
  ];
}
