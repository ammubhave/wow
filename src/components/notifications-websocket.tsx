import useWebSocket from "react-use-websocket";
import {toast} from "sonner";
import z from "zod";

import {authClient} from "@/lib/auth-client";
import {celebrate} from "@/lib/confetti";

import {toastDismissBroadcastChannel} from "./ui/sonner";

export function NotificationsWebSocket({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const notificationsEnabled = authClient.useSession().data?.user.notificationsDisabled === false;

  useWebSocket(
    `${typeof window !== "undefined" ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}` : ""}/api/notification/${workspaceSlug}`,
    {
      share: false,
      shouldReconnect: () => true,
      onMessage: async data => {
        const payload = z
          .discriminatedUnion("type", [
            z.object({type: z.literal("solved"), message: z.string()}),
            z.object({type: z.literal("announcement"), message: z.string()}),
          ])
          .parse(JSON.parse(data.data));
        if (payload.type === "solved") {
          if (notificationsEnabled) {
            await celebrate();
            toast.success(payload.message);
          }
        } else if (payload.type === "announcement") {
          if (notificationsEnabled) {
            toast.info("Announcement", {
              description: payload.message,
              duration: Infinity,
              onDismiss: t => {
                toastDismissBroadcastChannel?.postMessage(t.id);
              },
            });
          }
        }
      },
    }
  );
  return children;
}
