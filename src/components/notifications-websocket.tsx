import {useQueryClient} from "@tanstack/react-query";
import useWebSocket from "react-use-websocket";

export function NotificationsWebSocket({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  useWebSocket(
    `${typeof window !== "undefined" ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}` : ""}/api/notification/${workspaceId}`,
    {
      share: false,
      shouldReconnect: () => true,
      onMessage: () => {
        queryClient.invalidateQueries();
      },
    }
  );
  return children;
}
