// oxlint-disable-next-line import/no-unassigned-import -- Excalidraw's stylesheet, loaded with this lazy chunk.
import "@excalidraw/excalidraw/index.css";
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  reconcileElements,
  restoreElements,
} from "@excalidraw/excalidraw";
import type {RemoteExcalidrawElement} from "@excalidraw/excalidraw/data/reconcile";
import type {
  BinaryFileData,
  BinaryFiles,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";
import {useEffect, useRef, useState} from "react";
// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";

import {useTheme} from "@/components/theme-provider";
import type {WhiteboardReceivedMessage, WhiteboardSentMessage} from "@/server/do/whiteboard";

// Cost: every message to the room is billed, so strokes are batched and cursors throttled.
const ELEMENTS_FLUSH_MS = 200;
const POINTER_THROTTLE_MS = 100;

type Element = ReturnType<ExcalidrawImperativeAPI["getSceneElementsIncludingDeleted"]>[number];
type WireElement = {id: string; version: number; versionNonce: number};

// The room stores and relays Excalidraw's own element JSON untouched, so these are the only
// places its data is retyped between the wire and Excalidraw's branded types.
/* oxlint-disable typescript/no-unsafe-type-assertion */
const fromWire = (elements: unknown[]) => elements as RemoteExcalidrawElement[];
const toWire = (elements: readonly Element[]) => elements as unknown as WireElement[];
const asSocketId = (id: string) => id as SocketId;
const asFileData = (id: string, mimeType: string, dataURL: string): BinaryFileData => ({
  id: id as BinaryFileData["id"],
  mimeType: mimeType as BinaryFileData["mimeType"],
  dataURL: dataURL as BinaryFileData["dataURL"],
  created: Date.now(),
});
/* oxlint-enable typescript/no-unsafe-type-assertion */

function useResolvedTheme() {
  const {theme} = useTheme();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light";
}

async function dataUrlToBlob(dataURL: string) {
  return await (await fetch(dataURL)).blob();
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Couldn't read the file"))
    );
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Couldn't read the file"))
    );
    reader.readAsDataURL(blob);
  });
}

/** The puzzle's shared Excalidraw whiteboard, synced through its WhiteboardRoom. */
export default function WhiteboardCanvas({puzzleId}: {puzzleId: string}) {
  const theme = useResolvedTheme();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialElements, setInitialElements] = useState<ReturnType<typeof restoreElements> | null>(
    null
  );

  // What the room already has, per element id: changes at or below this version aren't resent.
  const knownVersions = useRef(new Map<string, number>());
  const collaborators = useRef(new Map<SocketId, Collaborator>());
  const peers = useRef(1);
  const uploadedFiles = useRef(new Set<string>());
  const requestedFiles = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPointerAt = useRef(0);
  // Socket handlers run outside render, so they read the editor through a ref kept in sync here.
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const {sendJsonMessage} = useWebSocket(`/api/whiteboard/${puzzleId}`, {
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; don't keep every message in React state.
    filter: () => false,
    onMessage: event => onServerMessage(JSON.parse(event.data)),
  });
  const send = (message: WhiteboardSentMessage) => sendJsonMessage(message);

  const remember = (elements: readonly {id: string; version: number}[]) => {
    for (const element of elements) {
      const known = knownVersions.current.get(element.id) ?? -1;
      if (element.version > known) knownVersions.current.set(element.id, element.version);
    }
  };

  /** Fetches images that teammates pasted and this browser doesn't have yet. */
  const loadMissingFiles = (elements: readonly RemoteExcalidrawElement[]) => {
    const current = apiRef.current;
    if (!current) return;
    const have = current.getFiles();
    for (const element of elements) {
      if (element.type !== "image" || !element.fileId || element.isDeleted) continue;
      const fileId = element.fileId;
      if (have[fileId] || requestedFiles.current.has(fileId)) continue;
      requestedFiles.current.add(fileId);
      void (async () => {
        const response = await fetch(`/api/whiteboard/${puzzleId}/files/${fileId}`);
        if (!response.ok) return;
        const blob = await response.blob();
        uploadedFiles.current.add(fileId);
        current.addFiles([asFileData(fileId, blob.type, await blobToDataUrl(blob))]);
      })();
    }
  };

  const applyRemote = (remote: RemoteExcalidrawElement[]) => {
    const current = apiRef.current;
    if (!current) return;
    remember(remote);
    const merged = reconcileElements(
      current.getSceneElementsIncludingDeleted(),
      remote,
      current.getAppState()
    );
    // Teammates' edits shouldn't land in this person's undo history.
    current.updateScene({elements: merged, captureUpdate: CaptureUpdateAction.NEVER});
    loadMissingFiles(remote);
  };

  function onServerMessage(message: WhiteboardReceivedMessage) {
    switch (message.type) {
      case "snapshot": {
        peers.current = message.peers;
        const elements = fromWire(message.elements);
        if (!apiRef.current && initialElements === null) {
          remember(elements);
          setInitialElements(restoreElements(elements, null));
        } else {
          // Reconnected: merge what the room has, then send anything changed while offline.
          applyRemote(elements);
          scheduleFlush();
        }
        return;
      }
      case "elements":
        applyRemote(fromWire(message.elements));
        return;
      case "peers":
        peers.current = message.peers;
        return;
      case "pointer": {
        const id = asSocketId(message.id);
        collaborators.current.set(id, {
          socketId: id,
          username: message.name,
          pointer: message.pointer,
          button: message.button,
          selectedElementIds: message.selectedElementIds,
        });
        apiRef.current?.updateScene({collaborators: new Map(collaborators.current)});
        return;
      }
      case "leave":
        collaborators.current.delete(asSocketId(message.id));
        apiRef.current?.updateScene({collaborators: new Map(collaborators.current)});
        return;
    }
  }

  /** Uploads newly pasted images (once each; ids are content hashes). */
  const uploadNewFiles = (elements: readonly Element[], files: BinaryFiles) => {
    for (const element of elements) {
      if (element.type !== "image" || !element.fileId || element.isDeleted) continue;
      const file = files[element.fileId];
      if (!file || uploadedFiles.current.has(file.id)) continue;
      uploadedFiles.current.add(file.id);
      void (async () => {
        const blob = await dataUrlToBlob(file.dataURL);
        await fetch(`/api/whiteboard/${puzzleId}/files/${file.id}`, {
          method: "PUT",
          headers: {"Content-Type": file.mimeType},
          body: blob,
        });
      })();
    }
  };

  /** Sends every element changed since the room last heard of it, in one message. */
  const flush = () => {
    flushTimer.current = null;
    const current = apiRef.current;
    if (!current) return;
    const elements = current.getSceneElementsIncludingDeleted();
    const changed = elements.filter(
      element => element.version > (knownVersions.current.get(element.id) ?? -1)
    );
    if (changed.length === 0) return;
    remember(changed);
    uploadNewFiles(changed, current.getFiles());
    send({type: "elements", elements: toWire(changed)});
  };
  const scheduleFlush = () => {
    flushTimer.current ??= setTimeout(flush, ELEMENTS_FLUSH_MS);
  };
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    },
    []
  );

  if (initialElements === null) {
    return (
      <div className="text-muted flex flex-1 items-center justify-center text-sm">
        Loading whiteboard…
      </div>
    );
  }

  return (
    // `[&_.default-sidebar-trigger]:hidden!` (important: Excalidraw's CSS is unlayered): no Library button, as its "browse libraries" opens
    // libraries.excalidraw.com.
    <div className="relative flex-1 [&_.default-sidebar-trigger]:hidden!">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{elements: initialElements, scrollToContent: true}}
        theme={theme}
        isCollaborating
        aiEnabled={false}
        UIOptions={{
          canvasActions: {
            // Nothing that saves to, loads from or shares via Excalidraw's own services.
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: null,
          },
          tools: {image: true},
        }}
        onChange={() => scheduleFlush()}
        onPointerUpdate={({pointer, button}) => {
          // Only worth sending when someone else is looking, and at most ~10 times a second.
          const now = Date.now();
          if (peers.current < 2 || now - lastPointerAt.current < POINTER_THROTTLE_MS) return;
          lastPointerAt.current = now;
          send({
            type: "pointer",
            pointer,
            button,
            selectedElementIds: apiRef.current?.getAppState().selectedElementIds,
          });
        }}>
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.DefaultItems.Help />
        </MainMenu>
      </Excalidraw>
    </div>
  );
}
