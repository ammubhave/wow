import { Outlet, useParams } from "react-router";

import { NotificationsWebSocket } from "@/components/notifications-websocket";

export default function Layout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <NotificationsWebSocket workspaceId={workspaceId!}>
      <Outlet />
    </NotificationsWebSocket>
  );
}
