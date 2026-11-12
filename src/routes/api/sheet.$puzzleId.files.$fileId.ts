import {createFileRoute} from "@tanstack/react-router";

import {puzzleFileHandlers} from "@/server/puzzle-files";

// Images in a puzzle's built-in sheet, named by the SHA-256 of their bytes (checked on upload).
export const Route = createFileRoute("/api/sheet/$puzzleId/files/$fileId")({
  server: {handlers: puzzleFileHandlers("sheets", {verifySha256: true})},
});
