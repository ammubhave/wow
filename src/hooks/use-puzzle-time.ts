import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {useEffect, useState} from "react";

import {orpc} from "@/lib/orpc";

/** How often (in counted seconds) the page saves your time while you're on it. */
const BATCH_SECONDS = 60;
/** The most one report may claim (the server's limit). */
const MAX_BATCH_SECONDS = 120;
/** No mouse, keyboard, touch or scrolling on the page for this long: you've stepped away. */
const IDLE_MS = 5 * 60_000;
/**
 * The same, while you're in the embedded sheet: its own clicks and typing never reach this page,
 * so it gets longer before the clock assumes you've stopped.
 */
const SHEET_IDLE_MS = 30 * 60_000;
const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"];

type PuzzleTimes = {puzzleId: string; seconds: number}[];

const myTimesQueryOptions = (workspaceSlug: string) =>
  orpc.puzzles.myTimes.queryOptions({input: {workspaceSlug}});

/** Your time on each puzzle in the workspace (most first). */
export function useMyPuzzleTimes(workspaceSlug: string) {
  return useQuery(myTimesQueryOptions(workspaceSlug)).data;
}

/** Counts a time toward a puzzle in the cached totals, so it shows before the next fetch. */
function addTime(times: PuzzleTimes, puzzleId: string, seconds: number): PuzzleTimes {
  const found = times.some(t => t.puzzleId === puzzleId);
  return (
    found
      ? times.map(t => (t.puzzleId === puzzleId ? {...t, seconds: t.seconds + seconds} : t))
      : [...times, {puzzleId, seconds}]
  ).toSorted((a, b) => b.seconds - a.seconds);
}

/**
 * Records your active time on a puzzle: every second its page is open in the tab you're looking at
 * (the tab is visible and the window has focus, including inside the embedded sheet) and you
 * haven't gone idle. Saved every minute, with the hour of day where you are, and right away when
 * you stop (unfocus, idle), leave the puzzle, or the page closes.
 *
 * Returns your total so far, live (`undefined` until your saved time has loaded), and whether it's
 * counting right now.
 */
export function usePuzzleTimeTracker(workspaceSlug: string, puzzleId: string) {
  const queryClient = useQueryClient();
  const saved = useMyPuzzleTimes(workspaceSlug);
  // The counted seconds not saved yet, and whether the clock is running.
  const [live, setLive] = useState({puzzleId, pending: 0, isCounting: false});
  const {mutate} = useMutation(
    orpc.puzzles.recordTime.mutationOptions({meta: {invalidates: false}})
  );

  useEffect(() => {
    let pending = 0;
    /** Saves the uncounted seconds. `beacon`: the page may be going away, so the browser sends it. */
    const flush = ({beacon = false} = {}) => {
      if (pending === 0) return;
      const input = {
        workspaceSlug,
        puzzleId,
        seconds: Math.min(pending, MAX_BATCH_SECONDS),
        // Your own time zone's hour, so "night owl" means late where you are.
        localHour: new Date().getHours(),
      };
      pending = 0;
      setLive(current => ({...current, pending: 0}));
      queryClient.setQueryData<PuzzleTimes>(myTimesQueryOptions(workspaceSlug).queryKey, times =>
        times ? addTime(times, puzzleId, input.seconds) : times
      );
      if (beacon) {
        // A request from the page itself can be cut off as it closes; a beacon still goes out.
        const body = new Blob([JSON.stringify({json: input})], {type: "application/json"});
        if (navigator.sendBeacon("/api/rpc/puzzles/recordTime", body)) return;
      }
      mutate(input);
    };
    let lastActivity = Date.now();
    const onActivity = () => {
      lastActivity = Date.now();
    };
    // Clicking into the sheet blurs this window (focus moves into its frame): that's activity too.
    const onBlur = () => {
      if (document.hasFocus()) onActivity();
    };
    const isActive = () => {
      const idleFor = Date.now() - lastActivity;
      const inSheet = document.activeElement?.tagName === "IFRAME";
      return idleFor < (inSheet ? SHEET_IDLE_MS : IDLE_MS);
    };
    const tick = window.setInterval(() => {
      // Focus inside the sheet's iframe still counts: the document has focus then too (while the
      // window's blur event fires), so this checks focus each second rather than listening.
      if (document.visibilityState !== "visible" || !document.hasFocus() || !isActive()) {
        flush(); // Just stopped (unfocused or idle): save what's counted.
        setLive(current => (current.isCounting ? {...current, isCounting: false} : current));
        return;
      }
      pending += 1;
      setLive({puzzleId, pending, isCounting: true});
      if (pending >= BATCH_SECONDS) flush();
    }, 1000);
    // Hidden (another tab, minimized, the phone locked) is often the last event a page gets.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush({beacon: true});
    };
    const onPageHide = () => flush({beacon: true});
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onBlur);
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, {capture: true, passive: true});
    }
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("blur", onBlur);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, {capture: true});
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, [workspaceSlug, puzzleId, queryClient, mutate]);

  if (saved === undefined) return {seconds: undefined, isCounting: false};
  const savedSeconds = saved.find(t => t.puzzleId === puzzleId)?.seconds ?? 0;
  // Right after switching puzzles, `live` may still describe the previous one.
  const current = live.puzzleId === puzzleId ? live : {pending: 0, isCounting: false};
  return {seconds: savedSeconds + current.pending, isCounting: current.isCounting};
}

/** As a clock: "0:42", "12:05", "1:02:03". */
export function formatPuzzleTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}
