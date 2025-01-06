import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { useEffect, useState } from "react";
import useWebSocket from "react-use-websocket";
import { z } from "zod";

import { trpc } from "@/lib/trpc";

function NotificationsWebSocketInner({
  workspaceId,
  token,
  children,
}: {
  workspaceId: string;
  token?: string;
  children: React.ReactNode;
}) {
  const utils = trpc.useUtils();
  const { lastJsonMessage } = useWebSocket(
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${typeof window !== "undefined" ? window.location.host : ""}/api/do/notification/${workspaceId}?token=${token}`,
    {
      share: false,
      shouldReconnect: () => true,
    },
  );
  useEffect(() => {
    if (!lastJsonMessage) {
      return;
    }
    const message = z
      .union([
        z.object({
          type: z.literal("notification"),
          paths: z
            .object({
              path: z.array(z.string()),
              input: z.any().optional(),
            })
            .array(),
        }),
        z.object({
          type: z.literal("message"),
          text: z.string(),
        }),
      ])
      .parse(lastJsonMessage);
    let u = utils;
    if (message.type === "notification") {
      for (const path of message.paths) {
        for (const pathSegment of path.path) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          u = (u as any)[pathSegment];
        }
        u.invalidate(path.input);
      }
    }
  }, [lastJsonMessage]);

  return children;
}

export function NotificationsWebSocket({
  workspaceId,
  children,
}: {
  workspaceId: string;
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
    <NotificationsWebSocketInner workspaceId={workspaceId} token={token}>
      {children}
    </NotificationsWebSocketInner>
  );
}
