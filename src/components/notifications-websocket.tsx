import useWebSocket from "react-use-websocket";
import {toast} from "sonner";
import z from "zod";

import {authClient} from "@/lib/auth-client";

import {toastDismissBroadcastChannel} from "./ui/sonner";

let confettiMod: Promise<any> | null = null;

function getConfetti() {
  if (!confettiMod) confettiMod = import("canvas-confetti").then(m => m.default ?? m);
  return confettiMod;
}

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
            const confetti = await getConfetti();
            var end = Date.now() + 1 * 1000;
            var colors = ["#f54900", "#e7000b"];
            (function frame() {
              confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: {x: 0, y: 1},
                colors: colors,
              });
              confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: {x: 1, y: 1},
                colors: colors,
              });
              if (Date.now() < end) {
                requestAnimationFrame(frame);
              }
            })();
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
