import {useEffect} from "react";
import useWebSocket from "react-use-websocket";
import {z} from "zod";

import {setPresences} from "@/features/presences/presences";
import {useAppDispatch} from "@/store";

export function PresencesWebSocket({
  workspaceSlug,
  puzzleId,
  children,
}: {
  workspaceSlug: string;
  puzzleId?: string;
  children: React.ReactNode;
}) {
  const {lastJsonMessage} = useWebSocket(
    puzzleId
      ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${typeof window !== "undefined" ? window.location.host : ""}/api/presence?workspaceSlug=${workspaceSlug}&puzzleId=${puzzleId}`
      : `${window.location.protocol === "https:" ? "wss" : "ws"}://${typeof window !== "undefined" ? window.location.host : ""}/api/presence?workspaceSlug=${workspaceSlug}`,
    {share: false, shouldReconnect: () => true}
  );
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }
    const payload = z
      .record(
        z.string(),
        z
          .object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            image: z.string().nullable(),
            displayUsername: z.string().nullable(),
          })
          .array()
      )
      .parse(lastJsonMessage);
    dispatch(setPresences(payload));
  }, [lastJsonMessage]);

  return children;
}
