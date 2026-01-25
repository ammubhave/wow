import {createContext, useContext} from "react";
import useWebSocket from "react-use-websocket";

import {Spinner} from "@/components/ui/spinner";
import {WorkspaceRoomState} from "@/server/do/workspace";

const WorkspaceContext = createContext<WorkspaceRoomState>({} as any);

export function WorkspaceProvider({
  children,
  workspaceSlug,
}: {
  children: React.ReactNode;
  workspaceSlug: string;
}) {
  const {lastJsonMessage} = useWebSocket<WorkspaceRoomState | null>(
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${typeof window !== "undefined" ? window.location.host : ""}/api/workspaces/${workspaceSlug}`,
    {share: true, shouldReconnect: () => true}
  );
  if (!lastJsonMessage)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  return <WorkspaceContext.Provider value={lastJsonMessage}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
