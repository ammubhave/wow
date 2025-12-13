import {useQueryClient} from "@tanstack/react-query";
import useWebSocket from "react-use-websocket";
import {toast} from "sonner";
import z from "zod";

let confettiMod: Promise<any> | null = null;

function getConfetti() {
  if (!confettiMod) confettiMod = import("canvas-confetti").then(m => m.default ?? m);
  return confettiMod;
}

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
      onMessage: async data => {
        const payload = z
          .discriminatedUnion("type", [
            z.object({type: z.literal("invalidate")}),
            z.object({type: z.literal("solved"), message: z.string()}),
          ])
          .parse(JSON.parse(data.data));
        if (payload.type === "invalidate") {
          await queryClient.invalidateQueries();
        } else if (payload.type === "solved") {
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
      },
    }
  );
  return children;
}
