import {createFileRoute} from "@tanstack/react-router";

import {puzzleFileHandlers} from "@/server/puzzle-files";

// Images shared in a puzzle's chat, by the SHA-256 of their bytes.
export const Route = createFileRoute("/api/chat/$puzzleId/images/$fileId")({
  server: {handlers: puzzleFileHandlers("chats", {verifySha256: true})},
});
