import {useRouter} from "@tanstack/react-router";
import {useEffect} from "react";

/** As the router's own "intent" preloading: how long a pointer rests on a link before it starts. */
const INTENT_DELAY_MS = 50;

/**
 * Preloads (code and data) the page an in-app link goes to when it's hovered or focused, for
 * links the router doesn't preload itself: HeroUI/React Aria ones (`href` on tabs, menu items,
 * buttons), which navigate through the router but aren't its `Link`s. So the workspace's section
 * tabs and the settings tabs open as instantly as any other link. (The router dedupes a preload
 * its own Link already started.)
 */
export function useAnchorPreload() {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: string | undefined;
    const inAppHref = (target: EventTarget | null) => {
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.origin !== window.location.origin ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download") ||
        anchor.pathname.startsWith("/api/")
      ) {
        return undefined;
      }
      // The path (the pages these links open load by path, not by their query).
      return anchor.pathname;
    };
    const onIntent = (event: Event) => {
      const href = inAppHref(event.target);
      if (href === current) return;
      current = href;
      clearTimeout(timer);
      if (href) {
        timer = setTimeout(
          () => void router.preloadRoute({to: href}).catch(() => {}),
          INTENT_DELAY_MS
        );
      }
    };
    document.addEventListener("pointerover", onIntent);
    document.addEventListener("focusin", onIntent);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
    };
  }, [router]);
}
