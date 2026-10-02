import {Spinner} from "@heroui/react";
import {CheckIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";

// Brief blips (a network hiccup, a deploy) reconnect within a moment; only say so if it lasts.
const SHOW_AFTER_MS = 1500;
const BACK_ONLINE_MS = 2000;

/**
 * A small floating notice while the workspace's live connection is down. Edits still save over
 * normal requests, but teammates' changes can't arrive until it's back, so the board may be
 * stale. Floats at the bottom so it never shifts the page.
 */
export function ConnectionBanner({isOpen}: {isOpen: boolean}) {
  const [state, setState] = useState<"hidden" | "connecting" | "reconnecting" | "back">("hidden");
  const hasConnected = useRef(false);
  const shown = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasConnected.current = true;
      if (!shown.current) return undefined;
      shown.current = false;
      setState("back");
      const timer = setTimeout(() => setState("hidden"), BACK_ONLINE_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      shown.current = true;
      setState(hasConnected.current ? "reconnecting" : "connecting");
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (state === "hidden") return null;
  return (
    <output
      aria-live="polite"
      className="bg-overlay shadow-overlay text-foreground fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm">
      {state === "back" ? (
        <>
          <CheckIcon className="text-success size-4" />
          Back online
        </>
      ) : (
        <>
          <Spinner size="sm" />
          {state === "reconnecting"
            ? "Reconnecting… teammates' changes will appear once you're back online."
            : "Connecting…"}
        </>
      )}
    </output>
  );
}
