import {z} from "zod";

import {joinPresence, leavePresence, setPresences} from "@/features/presences/presences";
import {apiSocketUrl} from "@/lib/api-endpoint";
import {useWebSocket} from "@/lib/use-websocket";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
});

/** The room sends everything once on connect, then only who joined or left where. */
const presenceMessageSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("snapshot"), presences: z.record(z.string(), userSchema.array())}),
  z.object({type: z.literal("join"), location: z.string(), user: userSchema}),
  z.object({type: z.literal("leave"), location: z.string(), userId: z.string()}),
]);

export function PresencesWebSocket({
  workspaceSlug,
  puzzleId,
  children,
}: {
  workspaceSlug: string;
  puzzleId?: string;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams({workspaceSlug});
  if (puzzleId) params.set("puzzleId", puzzleId);
  useWebSocket(apiSocketUrl(`/api/presence?${params}`), {
    share: false,
    shouldReconnect: () => true,
    // Dispatch straight from the message handler instead of mirroring `lastJsonMessage` through an
    // effect: no extra render per message, and a malformed message is dropped rather than throwing
    // during commit (which would take down the whole workspace tree).
    onMessage: event => {
      let data: unknown;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      const payload = presenceMessageSchema.safeParse(data);
      if (!payload.success) return;
      const message = payload.data;
      if (message.type === "snapshot") setPresences(message.presences);
      else if (message.type === "join") joinPresence(message);
      else leavePresence(message);
    },
    // Nothing reads `lastMessage`; skip storing it so messages don't re-render this component.
    filter: () => false,
  });

  return children;
}
