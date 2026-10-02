import {createFileRoute} from "@tanstack/react-router";

import {puzzleFileHandlers} from "@/server/puzzle-files";

// Images pasted onto a puzzle's whiteboard, by Excalidraw's file id (a content hash).
export const Route = createFileRoute("/api/whiteboard/$puzzleId/files/$fileId")({
  server: {handlers: puzzleFileHandlers("whiteboards")},
});
