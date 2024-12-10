import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";
import { z } from "zod";

import { setPresences } from "@/features/presences/presences";
import { useAppDispatch } from "@/store";

function PresencesWebSocketInner({
  workspaceId,
  puzzleId,
  token,
  children,
}: {
  workspaceId?: string;
  puzzleId?: string;
  token?: string;
  children: React.ReactNode;
}) {
  const { lastJsonMessage } = useWebSocket(
    puzzleId
      ? `wss://${typeof window !== "undefined" ? window.location.host : ""}/api/do/presence/puzzles/${puzzleId}?token=${token}`
      : `wss://${typeof window !== "undefined" ? window.location.host : ""}/api/do/presence/workspaces/${workspaceId}?token=${token}`,
    {
      share: false,
      shouldReconnect: () => true,
    },
  );
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }
    const payload = z.record(z.string().array()).parse(lastJsonMessage);
    dispatch(setPresences(payload));
  }, [lastJsonMessage]);

  return children;
}

export function PresencesWebSocket({
  workspaceId,
  puzzleId,
  children,
}: {
  workspaceId?: string;
  puzzleId?: string;
  children: React.ReactNode;
}) {
  const { getIdToken } = useKindeAuth();
  const [token, setToken] = useState<string | undefined>();
  useEffect(() => {
    getIdToken?.().then((token) => setToken(token));
  }, [getIdToken]);

  if (!token) {
    return <></>;
  }

  return (
    <PresencesWebSocketInner
      workspaceId={workspaceId}
      puzzleId={puzzleId}
      token={token}
    >
      {children}
    </PresencesWebSocketInner>
  );
}
