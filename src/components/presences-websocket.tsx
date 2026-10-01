// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import {z} from "zod";

import {setPresences} from "@/features/presences/presences";
import {useAppDispatch} from "@/store";

const presencesMessageSchema = z.record(
  z.string(),
  z
    .object({id: z.string(), name: z.string(), email: z.string(), image: z.string().nullable()})
    .array()
);

export function PresencesWebSocket({
  workspaceSlug,
  puzzleId,
  children,
}: {
  workspaceSlug: string;
  puzzleId?: string;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const params = new URLSearchParams({workspaceSlug});
  if (puzzleId) params.set("puzzleId", puzzleId);
  useWebSocket(`/api/presence?${params}`, {
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
      const payload = presencesMessageSchema.safeParse(data);
      if (payload.success) dispatch(setPresences(payload.data));
    },
    // Nothing reads `lastMessage`; skip storing it so messages don't re-render this component.
    filter: () => false,
  });

  return children;
}
