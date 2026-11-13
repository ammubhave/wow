/* oxlint-disable import/no-unassigned-import -- Univer's stylesheets, loaded with this lazy chunk. */
import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-drawing/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-hyper-link/lib/index.css";
import "@univerjs/preset-sheets-note/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-thread-comment/lib/index.css";
/* oxlint-enable import/no-unassigned-import */
import {useQuery} from "@tanstack/react-query";
import {UniverSheetsConditionalFormattingPreset} from "@univerjs/preset-sheets-conditional-formatting";
import ConditionalFormattingEnUS from "@univerjs/preset-sheets-conditional-formatting/locales/en-US";
import {UniverSheetsCorePreset} from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import {UniverSheetsDataValidationPreset} from "@univerjs/preset-sheets-data-validation";
import DataValidationEnUS from "@univerjs/preset-sheets-data-validation/locales/en-US";
import {UniverSheetsDrawingPreset} from "@univerjs/preset-sheets-drawing";
import DrawingEnUS from "@univerjs/preset-sheets-drawing/locales/en-US";
import {UniverSheetsFilterPreset} from "@univerjs/preset-sheets-filter";
import FilterEnUS from "@univerjs/preset-sheets-filter/locales/en-US";
import {UniverSheetsFindReplacePreset} from "@univerjs/preset-sheets-find-replace";
import FindReplaceEnUS from "@univerjs/preset-sheets-find-replace/locales/en-US";
import {UniverSheetsHyperLinkPreset} from "@univerjs/preset-sheets-hyper-link";
import HyperLinkEnUS from "@univerjs/preset-sheets-hyper-link/locales/en-US";
import {UniverSheetsNotePreset} from "@univerjs/preset-sheets-note";
import NoteEnUS from "@univerjs/preset-sheets-note/locales/en-US";
import {UniverSheetsSortPreset} from "@univerjs/preset-sheets-sort";
import SortEnUS from "@univerjs/preset-sheets-sort/locales/en-US";
import {UniverSheetsThreadCommentPreset} from "@univerjs/preset-sheets-thread-comment";
import ThreadCommentEnUS from "@univerjs/preset-sheets-thread-comment/locales/en-US";
import {
  CommandType,
  createUniver,
  type FUniver,
  IImageIoService,
  LifecycleStages,
  LocaleType,
  mergeLocales,
  type Univer,
  UserManagerService,
} from "@univerjs/presets";
import {posthog} from "posthog-js";
import {useEffect, useRef, useState} from "react";
import {ReadyState} from "react-use-websocket/dist/lib/constants";
import {toast} from "sonner";

import {useResolvedTheme} from "@/components/theme-provider";
import {useWorkspace} from "@/hooks/use-workspace";
import {track} from "@/lib/analytics";
import {authClient} from "@/lib/auth-client";
import {orpc} from "@/lib/orpc";
import {useWebSocket} from "@/lib/use-websocket";
import {ACCENTS} from "@/lib/workspace-theme";
import type {
  SheetMutation,
  SheetPeer,
  SheetPresence,
  SheetReceivedMessage,
  SheetSentMessage,
} from "@/server/do/sheet";

import {registerGoogleFunctions} from "./google-functions";
import {registerPuzzleFunctions} from "./puzzle-functions";
import {CollabBar, type SyncStatus} from "./sheet-collab-bar";
import {CrosswordOverlay} from "./sheet-crossword-overlay";
import {isPersonalMutation, restoreFilters, saveFilters, shiftFilters} from "./sheet-filters";
import {firstVisibleCell, viewportOf} from "./sheet-geometry";
import {uploadImagesToPuzzleFiles} from "./sheet-images";
import {registerSheetMenus} from "./sheet-menus";
import {mapRanges} from "./sheet-ot";
import {PresenceOverlay} from "./sheet-presence";
import {isForUnit, SheetSync, wireBytes} from "./sheet-sync";
import {sheetTheme} from "./sheet-theme";

// Selections go out at most this often while someone drags across cells.
const PRESENCE_THROTTLE_MS = 80;
// How long after a filter change it's remembered (a filter change is several edits in a row).
const FILTER_SAVE_MS = 300;
// After scrolling stops, how long until the new top-left cell is shared (for followers).
const VIEW_SETTLE_MS = 250;

type Engine = {univer: Univer; api: FUniver; sync: SheetSync};

function without<T>(map: ReadonlyMap<string, T>, id: string) {
  const next = new Map(map);
  next.delete(id);
  return next;
}

/** Only the fields the room accepts (Univer's ranges carry more). */
const toRanges = (ranges: SheetPresence["ranges"]): SheetPresence["ranges"] =>
  ranges
    .slice(0, 20)
    .map(r => ({
      startRow: r.startRow,
      endRow: r.endRow,
      startColumn: r.startColumn,
      endColumn: r.endColumn,
      rangeType: r.rangeType,
    }));

/**
 * The puzzle's spreadsheet (Univer), kept in sync with its SheetRoom by SheetSync, with teammates
 * on top: their selections, the cells they're typing in, and a bar to jump to and follow them.
 */
export default function SheetCanvas({puzzleId}: {puzzleId: string}) {
  const theme = useResolvedTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const unitId = `puzzle-${puzzleId}`;
  const [engine, setEngine] = useState<Engine | null>(null);
  // Socket, DOM and Univer callbacks run outside render, so they read these through refs.
  const engineRef = useRef<Engine | null>(null);
  const [peers, setPeers] = useState<ReadonlyMap<string, SheetPeer>>(new Map());
  const [following, setFollowing] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  /** Bumped when cells move on screen (edits, resizing), to redraw the overlay. */
  const [layout, setLayout] = useState(0);

  const myPresence = useRef<SheetPresence | null>(null);
  /** The signed-in user's id, for toolbar actions (Univer's menus are set up once). */
  const myUserId = useRef<string | undefined>(undefined);
  const presenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {sendJsonMessage, readyState} = useWebSocket(`/api/sheet/${puzzleId}`, {
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; don't keep every message in React state.
    filter: () => false,
    onMessage: event => onServerMessage(JSON.parse(event.data)),
  });
  const send = (message: SheetSentMessage) => sendJsonMessage(message);

  /** Merges into this person's presence and shares it (throttled). */
  const updatePresence = (patch: Partial<SheetPresence>) => {
    const current = myPresence.current ?? {sheetId: "", ranges: []};
    myPresence.current = {...current, ...patch};
    presenceTimer.current ??= setTimeout(() => {
      presenceTimer.current = null;
      send({type: "presence", presence: myPresence.current});
    }, PRESENCE_THROTTLE_MS);
  };

  /** Moves teammates' outlines along with rows and columns that were inserted or removed. */
  const shiftPeers = (mutations: SheetMutation[]) => {
    setPeers(current => {
      const next = new Map<string, SheetPeer>();
      for (const [id, peer] of current) {
        const presence = peer.presence;
        next.set(
          id,
          presence
            ? {
                ...peer,
                presence: {
                  ...presence,
                  ranges: mapRanges(presence.ranges, presence.sheetId, mutations),
                },
              }
            : peer
        );
      }
      return next;
    });
  };

  function onServerMessage(message: SheetReceivedMessage) {
    switch (message.type) {
      case "init":
        setPeers(new Map(message.peers.map(peer => [peer.id, peer])));
        break;
      case "presence":
        setPeers(current => new Map(current).set(message.id, message));
        return;
      case "leave":
        setPeers(current => without(current, message.id));
        setFollowing(current => (current === message.id ? null : current));
        return;
      default:
        break;
    }
    engineRef.current?.sync.handle(message);
  }

  // Univer owns its DOM, so it's created once per puzzle and torn down on unmount.
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return undefined;
    // Each instance gets its own element, since the previous one is torn down after this mounts.
    const container = document.createElement("div");
    container.className = "absolute inset-0";
    parent.appendChild(container);
    const {univer, univerAPI} = createUniver({
      locale: LocaleType.EN_US,
      locales: {
        [LocaleType.EN_US]: mergeLocales(
          UniverPresetSheetsCoreEnUS,
          ConditionalFormattingEnUS,
          DataValidationEnUS,
          DrawingEnUS,
          FilterEnUS,
          FindReplaceEnUS,
          HyperLinkEnUS,
          NoteEnUS,
          SortEnUS,
          ThreadCommentEnUS
        ),
      },
      darkMode: theme === "dark",
      // The free (Apache-2.0) add-ons that close most of the gap with Google Sheets. Each one's
      // edits are ordinary mutations naming this workbook, so they sync like cell edits.
      presets: [
        UniverSheetsCorePreset({container, header: true, footer: {}}),
        UniverSheetsConditionalFormattingPreset(),
        UniverSheetsDataValidationPreset(),
        UniverSheetsDrawingPreset(),
        UniverSheetsFilterPreset(),
        UniverSheetsFindReplacePreset(),
        UniverSheetsHyperLinkPreset(),
        UniverSheetsNotePreset(),
        UniverSheetsSortPreset(),
        UniverSheetsThreadCommentPreset(),
      ],
    });
    registerSheetMenus(univerAPI, () => myUserId.current);
    // Images go to the puzzle's files (R2), not into the sheet itself.
    // oxlint-disable-next-line no-underscore-dangle -- Univer's dependency injector.
    uploadImagesToPuzzleFiles(univer.__getInjector().get(IImageIoService), puzzleId);
    const sync = new SheetSync(univer, univerAPI, unitId, send, {
      onRemoteApplied: mutations => {
        shiftPeers(mutations);
        if (shiftFilters(univerAPI, unitId, mutations)) {
          saveFilters(univerAPI, unitId, puzzleId, sync.confirmedSeq);
        }
      },
      onPendingChange: setPending,
      onWorkbookLoaded: entries => {
        restoreFilters(univerAPI, unitId, puzzleId, entries);
        // Univer doesn't announce the selection a sheet opens with: share it, so teammates see
        // where this person is before they click anything.
        later(() => {
          const sheet = univerAPI.getActiveWorkbook()?.getActiveSheet();
          const range = sheet?.getSelection()?.getActiveRange()?.getRange();
          if (sheet && range)
            updatePresence({sheetId: sheet.getSheetId(), ranges: toRanges([range])});
        }, 0);
      },
      onResync: dropped => {
        track("sheet_resynced", {dropped_unsent_edits: dropped});
        if (dropped) {
          toast.warning("Your sheet was out of step with your team's and was reloaded.", {
            id: "sheet-resync",
          });
        }
      },
      onProblem: problem => {
        if (problem.kind === "apply-failed") {
          // Which kind of edit, never what it contained.
          if (import.meta.env.PROD) {
            posthog.captureException(problem.error, {sheet_mutation: problem.mutationId});
          } else {
            console.warn(`Couldn't apply ${problem.mutationId} from a teammate`, problem.error);
          }
        } else {
          track("sheet_offline_edits_dropped");
          toast.warning("Edits you made while offline couldn't be merged and were dropped.", {
            id: "sheet-offline-dropped",
          });
        }
      },
      onTooBig: reverted => {
        track("sheet_edit_too_big", {reverted});
        toast.error(
          reverted
            ? "That's too big to share with your team (over 30 MB), so it was undone."
            : "That's too big to share with your team (over 30 MB). Only you can see it: reload to drop it.",
          // One message, however many parts of the edit were too big.
          {id: "sheet-too-big"}
        );
      },
    });
    const next = {univer, api: univerAPI, sync};
    engineRef.current = next;
    setEngine(next);

    const redraw = () => setLayout(n => n + 1);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
      return timer;
    };

    // Scrolling or clicking yourself means you're done following someone.
    const stopFollowing = () => setFollowing(null);
    parent.addEventListener("wheel", stopFollowing, {capture: true, passive: true});
    parent.addEventListener("pointerdown", stopFollowing, {capture: true});

    // Puzzle functions, once the formula engine is up (it starts with the first workbook): it
    // recalculates right after a function is registered. univer.dispose() unregisters them.
    let functionsRegistered = false;
    let viewTimer: ReturnType<typeof setTimeout> | null = null;
    let filterTimer: ReturnType<typeof setTimeout> | null = null;
    const disposables = [
      univerAPI.addEvent(univerAPI.Event.LifeCycleChanged, ({stage}) => {
        if (functionsRegistered || stage < LifecycleStages.Rendered) return;
        functionsRegistered = true;
        registerPuzzleFunctions(univerAPI);
        registerGoogleFunctions(univerAPI);
      }),
      univerAPI.addEvent(univerAPI.Event.CommandExecuted, event => {
        if (event.type !== CommandType.MUTATION) return;
        redraw();
        const options = event.options;
        if (options?.fromCollab || options?.onlyLocal || options?.fromChangeset) return;
        // This person's filters: kept in their browser, not shared.
        if (isPersonalMutation(event.id)) {
          if (filterTimer) clearTimeout(filterTimer);
          filterTimer = later(
            () => saveFilters(univerAPI, unitId, puzzleId, sync.confirmedSeq),
            FILTER_SAVE_MS
          );
          return;
        }
        // Only the workbook's own changes: Univer's cell editor and formula bar are documents
        // too, and their keystrokes (before a cell is committed) must stay in this browser.
        if (!isForUnit(event.params, unitId) || !sync.ready) return;
        // Plain JSON on the wire.
        const json = JSON.stringify(event.params ?? {});
        const mutation: SheetMutation = {id: event.id, params: JSON.parse(json)};
        sync.local(mutation, wireBytes(json) + event.id.length);
        shiftPeers([mutation]);
      }),
      univerAPI.addEvent(univerAPI.Event.SelectionChanged, event => {
        updatePresence({sheetId: event.worksheet.getSheetId(), ranges: toRanges(event.selections)});
      }),
      univerAPI.addEvent(univerAPI.Event.SheetEditStarted, event => {
        updatePresence({editing: {row: event.row, col: event.column}});
      }),
      univerAPI.addEvent(univerAPI.Event.SheetEditEnded, () => {
        updatePresence({editing: null});
      }),
      univerAPI.addEvent(univerAPI.Event.Scroll, () => {
        // Share where this person is looking once scrolling settles, for anyone following.
        if (viewTimer) clearTimeout(viewTimer);
        viewTimer = later(() => {
          const sheet = univerAPI.getActiveWorkbook()?.getActiveSheet();
          const view = sheet && viewportOf(univerAPI, sheet);
          if (!sheet || !view) return;
          // The first cell of the scrolling part (past any frozen rows and columns).
          updatePresence({sheetId: sheet.getSheetId(), view: firstVisibleCell(view)});
        }, VIEW_SETTLE_MS);
      }),
    ];
    const resize = new ResizeObserver(redraw);
    resize.observe(container);
    // For poking at the sheet from the console while developing.
    if (import.meta.env.DEV) Object.assign(window, {__sheet: next});

    return () => {
      if (presenceTimer.current) clearTimeout(presenceTimer.current);
      presenceTimer.current = null;
      for (const timer of timers) clearTimeout(timer);
      for (const d of disposables) d.dispose();
      parent.removeEventListener("wheel", stopFollowing, {capture: true});
      parent.removeEventListener("pointerdown", stopFollowing, {capture: true});
      resize.disconnect();
      engineRef.current = null;
      setEngine(null);
      // Later, not now: Univer unmounts its own React root, which React refuses during this commit.
      setTimeout(() => {
        univer.dispose();
        container.remove();
      });
    };
    // Recreated only for another puzzle; theme changes are applied below.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzleId]);

  // On every (re)connection, once Univer is up: ask for the sheet (or what was missed), and
  // show this person's selection again.
  useEffect(() => {
    if (!engine || readyState !== ReadyState.OPEN) return;
    send(engine.sync.hello());
    if (myPresence.current) send({type: "presence", presence: myPresence.current});
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, readyState]);

  useEffect(() => {
    engine?.api.toggleDarkMode(theme === "dark");
  }, [engine, theme]);

  // Univer in the workspace's accent colour (the default accent is read from the page once
  // it's applied, after this commit, hence the timer).
  const accent = ACCENTS.find(a => a.id === useWorkspace().theme.accent)?.color ?? null;
  useEffect(() => {
    if (!engine) return undefined;
    const timer = setTimeout(() => {
      engine.api.setTheme(sheetTheme(accent));
      // A new theme may reset dark mode.
      engine.api.toggleDarkMode(theme === "dark");
    });
    return () => clearTimeout(timer);
  }, [engine, accent, theme]);

  // Comments and notes are signed by the current user, and show teammates by name. Univer's
  // built-in permissions grant editing by user id prefix ("Owner_…"; any other id is read-only),
  // and everyone on the team may edit, so every WOW user is an owner here.
  const me = authClient.useSession().data?.user;
  myUserId.current = me?.id;
  const workspace = useWorkspace();
  const members = useQuery(
    orpc.workspaces.members.list.queryOptions({input: {workspaceSlug: workspace.slug}})
  ).data?.members;
  useEffect(() => {
    if (!engine) return;
    // oxlint-disable-next-line no-underscore-dangle -- Univer's dependency injector.
    const users = engine.univer.__getInjector().get(UserManagerService);
    const asUniverUser = (user: {id: string; name: string; image?: string | null}) => ({
      userID: `Owner_${user.id}`,
      name: user.name,
      avatar: user.image ?? undefined,
    });
    for (const member of members ?? []) users.addUser(asUniverUser(member.user));
    if (me) users.setCurrentUser(asUniverUser(me));
  }, [engine, me, members]);

  // Following someone: show their sheet, scrolled where they are (or to their selection).
  const followed = following ? peers.get(following)?.presence : undefined;
  const followKey = followed
    ? JSON.stringify([followed.sheetId, followed.view, followed.view ? null : followed.ranges[0]])
    : null;
  useEffect(() => {
    if (!engine || !followed) return;
    const workbook = engine.api.getActiveWorkbook();
    const sheet = workbook?.getSheetBySheetId(followed.sheetId);
    if (!workbook || !sheet) return;
    if (workbook.getActiveSheet().getSheetId() !== followed.sheetId) workbook.setActiveSheet(sheet);
    const target = followed.view ?? {
      row: followed.ranges[0]?.startRow ?? 0,
      col: followed.ranges[0]?.startColumn ?? 0,
    };
    try {
      sheet.scrollToCell(target.row, target.col);
    } catch {
      // Univer's renderer isn't up (the sheet is hidden): the next move scrolls it.
    }
    // Only when where they are changes, not on every presence update.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, followKey]);

  const status: SyncStatus = !engine?.sync.ready
    ? "connecting"
    : readyState !== ReadyState.OPEN
      ? "offline"
      : pending
        ? "saving"
        : "saved";

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden">
      {engine && <CrosswordOverlay api={engine.api} layout={layout} />}
      {engine && <PresenceOverlay api={engine.api} peers={peers} layout={layout} />}
      <CollabBar peers={peers} following={following} onFollow={setFollowing} status={status} />
    </div>
  );
}
