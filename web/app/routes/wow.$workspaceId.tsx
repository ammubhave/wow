import { Outlet, useParams } from "@remix-run/react";

import { NotificationsWebSocket } from "@/components/notifications-websocket";

export default function Layout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <NotificationsWebSocket workspaceId={workspaceId!}>
      <Outlet />
    </NotificationsWebSocket>
  );
}
