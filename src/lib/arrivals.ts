import {useState} from "react";

/**
 * Live items (new chat messages, activity entries) slide in as they arrive; what was already there
 * when the view opened, or older history loaded later, just appears. Compare an item's timestamp
 * against the time the view mounted to tell them apart.
 */
export function useMountedAt() {
  const [mountedAt] = useState(() => Date.now());
  return mountedAt;
}

const ARRIVAL = "animate-in fade-in duration-300 ease-out motion-reduce:animate-none";
/** For lists whose newest item is at the top (the activity feed). */
export const ARRIVE_FROM_TOP = `${ARRIVAL} slide-in-from-top-2`;
/** For lists whose newest item is at the bottom (chat). */
export const ARRIVE_FROM_BOTTOM = `${ARRIVAL} slide-in-from-bottom-2`;
