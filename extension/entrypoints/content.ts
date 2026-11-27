import {findHuntSolve} from "@/lib/hunt-solve";

import {
  ask,
  type PageMessage,
  type PuzzleMatch,
  type SidebarMessage,
  type TabMessage,
} from "../lib/messages";

/**
 * On every page: asks the background whether it's one of your puzzles (by its link, in your
 * default workspace) and if so shows WOW's sidebar for it on the right, over the page. The sidebar
 * is an extension page in an iframe (sidebar.html), so the hunt's page never sees WOW's data or
 * your sign-in. It collapses to a tab on the edge, and stays collapsed (or not) as you browse.
 *
 * While it's shown, it also reads whether the page says the puzzle is solved (lib/hunt-solve.ts),
 * again whenever the page changes (guesses are often answered without a reload), and tells the
 * sidebar, which offers to mark it solved in WOW. The collapsed tab shows a dot while it offers.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  excludeMatches: [`${import.meta.env.WOW_ORIGIN}/*`],
  runAt: "document_idle",
  main(ctx) {
    const WIDTH = 400;
    const COLLAPSED = "sidebarCollapsed";
    let host: HTMLElement | undefined;
    let frame: HTMLIFrameElement | undefined;
    let tab: HTMLButtonElement | undefined;
    let dot: HTMLElement | undefined;
    let shown: PuzzleMatch | null = null;
    let collapsed = false;
    /** What the page says it was solved as (undefined: not read yet). */
    let huntAnswer: string | null | undefined;
    let offering = false;

    function render() {
      if (!host || !frame || !tab || !dot) return;
      frame.style.display = collapsed ? "none" : "block";
      tab.style.display = collapsed ? "flex" : "none";
      tab.title = offering ? "Show WOW: the hunt says this puzzle is solved" : "Show WOW";
      dot.style.display = offering ? "block" : "none";
      host.style.width = collapsed ? "auto" : `${WIDTH}px`;
    }

    function tellSidebar(message: PageMessage) {
      frame?.contentWindow?.postMessage(message, new URL(browser.runtime.getURL("/")).origin);
    }

    /** Reads the page again, and tells the sidebar if what it says changed (or `always`). */
    function readSolve(always = false) {
      if (!shown) return;
      const answer = findHuntSolve(document.body?.innerText ?? "");
      if (!always && answer === huntAnswer) return;
      huntAnswer = answer;
      tellSidebar({source: "wow-page", type: "huntSolve", answer});
    }

    // Hunt pages change as you guess: read again once they've settled for a moment.
    let reread: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(reread);
      reread = setTimeout(() => readSolve(), 750);
    });
    ctx.onInvalidated(() => {
      observer.disconnect();
      clearTimeout(reread);
    });

    function mount(match: PuzzleMatch) {
      if (!host) {
        host = document.createElement("wow-sidebar");
        const shadow = host.attachShadow({mode: "closed"});
        Object.assign(host.style, {
          position: "fixed",
          top: "0",
          right: "0",
          height: "100vh",
          zIndex: "2147483647",
          display: "flex",
          alignItems: "center",
        });
        frame = document.createElement("iframe");
        frame.title = "WOW";
        // Calls in the sidebar need the microphone, camera and screen; "Copy link", the clipboard.
        frame.allow = "microphone; camera; display-capture; clipboard-write; autoplay";
        Object.assign(frame.style, {
          width: `${WIDTH}px`,
          height: "100%",
          border: "0",
          borderLeft: "1px solid rgba(127,127,127,.3)",
          boxShadow: "-4px 0 16px rgba(0,0,0,.15)",
          colorScheme: "normal",
          background: "transparent",
        });
        tab = document.createElement("button");
        tab.type = "button";
        tab.title = "Show WOW";
        tab.setAttribute("aria-label", "Show WOW");
        Object.assign(tab.style, {
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "40px",
          padding: "0",
          border: "1px solid rgba(127,127,127,.35)",
          borderRight: "0",
          borderRadius: "8px 0 0 8px",
          background: "#1c1c1c",
          boxShadow: "-2px 0 8px rgba(0,0,0,.2)",
          cursor: "pointer",
        });
        const icon = document.createElement("img");
        icon.src = browser.runtime.getURL("/icon/32.png");
        icon.alt = "";
        Object.assign(icon.style, {width: "20px", height: "20px"});
        tab.appendChild(icon);
        dot = document.createElement("span");
        Object.assign(dot.style, {
          display: "none",
          position: "absolute",
          top: "5px",
          left: "5px",
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "#22c55e",
          boxShadow: "0 0 0 2px #1c1c1c",
        });
        tab.style.position = "relative";
        tab.appendChild(dot);
        tab.addEventListener("click", () => setCollapsed(false));
        shadow.appendChild(tab);
        shadow.appendChild(frame);
        document.documentElement.appendChild(host);
      }
      if (shown?.puzzleId !== match.puzzleId || shown.workspaceSlug !== match.workspaceSlug) {
        frame!.src = sidebarUrl(match);
        offering = false;
      }
      if (!shown && document.body) {
        observer.observe(document.body, {childList: true, subtree: true, characterData: true});
      }
      shown = match;
      render();
    }

    function unmount() {
      observer.disconnect();
      clearTimeout(reread);
      host?.remove();
      host = frame = tab = dot = undefined;
      shown = null;
      huntAnswer = undefined;
      offering = false;
    }

    function setCollapsed(next: boolean) {
      collapsed = next;
      void browser.storage.local.set({[COLLAPSED]: next});
      render();
    }

    let checking = 0;
    async function check() {
      const run = ++checking;
      const match = await ask({type: "matchUrl", url: location.href}).catch(() => null);
      if (run !== checking || ctx.isInvalid) return;
      if (match) mount(match);
      else unmount();
    }

    // Only the sidebar's own frame is listened to.
    ctx.addEventListener(window, "message", (event: MessageEvent<SidebarMessage>) => {
      if (event.source !== frame?.contentWindow || event.data?.source !== "wow-sidebar") return;
      const message = event.data;
      if (message.type === "collapse") setCollapsed(true);
      else if (message.type === "ready") readSolve(true);
      else if (message.type === "solveOffer") {
        offering = message.shown;
        render();
      }
    });

    browser.runtime.onMessage.addListener((message: TabMessage) => {
      if (message.type === "pageInfo") {
        return Promise.resolve({title: puzzleTitle(), url: location.href});
      }
      if (message.type === "sidebarShown") {
        const open = !collapsed && document.visibilityState === "visible";
        return Promise.resolve(shown && open ? {puzzleId: shown.puzzleId} : null);
      }
      if (message.type === "expand") setCollapsed(false);
      void check();
      return undefined;
    });

    // Single-page hunt sites change the URL without loading a new page.
    ctx.addEventListener(window, "wxt:locationchange", () => void check());
    void (async () => {
      collapsed = (await browser.storage.local.get(COLLAPSED))[COLLAPSED] === true;
      await check();
    })();
  },
});

function sidebarUrl(match: PuzzleMatch) {
  const url = new URL(browser.runtime.getURL("/sidebar.html"));
  url.searchParams.set("workspace", match.workspaceSlug);
  url.searchParams.set("puzzle", match.puzzleId);
  return url.toString();
}

/**
 * The page's puzzle name, as best a hunt page tells it: its one main heading if it has a short one
 * (hunt sites title the tab "Puzzle | Hunt 2027"), else the tab's title.
 */
function puzzleTitle() {
  const headings = document.querySelectorAll("h1");
  const heading = headings.length === 1 ? headings[0]?.textContent?.trim() : undefined;
  if (heading && heading.length <= 120) return heading.replace(/\s+/g, " ");
  return document.title.trim();
}
