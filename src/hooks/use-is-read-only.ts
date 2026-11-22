import {useWorkspace} from "@/hooks/use-workspace";

/**
 * Whether the current workspace is read-only: an owner archived it. Everyone can still look at
 * everything, but nothing can change (the server refuses it too), so editing controls are hidden or
 * disabled while this is true. Unarchiving (Settings > Administration, or the banner) undoes it.
 */
export function useIsReadOnly() {
  return useWorkspace().archivedAt !== null;
}
