// react-use-websocket is CommonJS-only; its named export interops reliably (the default does not).
import {useWebSocket} from "react-use-websocket/dist/lib/use-websocket";
import {toast} from "sonner";
import {z} from "zod";

import {authClient} from "@/lib/auth-client";
import {celebrate} from "@/lib/confetti";

const toastDismissBroadcastChannel =
  typeof window !== "undefined" ? new BroadcastChannel("sonner-dismiss") : null;
if (toastDismissBroadcastChannel) {
  toastDismissBroadcastChannel.addEventListener("message", event => {
    toast.dismiss(event.data);
  });
}

const notificationSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("solved"), message: z.string()}),
  // `from` is missing on announcements sent before it was added.
  z.object({type: z.literal("announcement"), message: z.string(), from: z.string().optional()}),
]);

export function NotificationsWebSocket({
  workspaceSlug,
  children,
}: {
  workspaceSlug: string;
  children: React.ReactNode;
}) {
  const notificationsEnabled = authClient.useSession().data?.user.notificationsDisabled === false;

  useWebSocket(`/api/notification/${workspaceSlug}`, {
    share: false,
    shouldReconnect: () => true,
    // Nothing reads `lastMessage`; skip storing it so messages don't re-render the subtree.
    filter: () => false,
    onMessage: async data => {
      let json: unknown;
      try {
        json = JSON.parse(data.data);
      } catch {
        return;
      }
      // A malformed message is dropped rather than surfacing as an unhandled rejection.
      const parsed = notificationSchema.safeParse(json);
      if (!parsed.success) return;
      const payload = parsed.data;
      if (payload.type === "solved") {
        if (notificationsEnabled) {
          // The toast must still show if the (lazily loaded) confetti fails.
          await celebrate().catch(() => {});
          toast.success(payload.message);
        }
      } else if (payload.type === "announcement") {
        if (notificationsEnabled) {
          toast.info(payload.from ? `Announcement from ${payload.from}` : "Announcement", {
            description: payload.message,
            duration: Infinity,
            onDismiss: t => {
              // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel.postMessage takes no targetOrigin (same-origin only).
              toastDismissBroadcastChannel?.postMessage(t.id);
            },
          });
        }
      }
    },
  });
  return children;
}
