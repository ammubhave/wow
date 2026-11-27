/**
 * WOW's service worker. Its one job is Web Push: showing notifications that arrive while WOW
 * isn't open (sent by src/server/push.ts; see src/features/notifications/push.ts for subscribing),
 * and opening the right page when one is clicked. It doesn't cache or intercept anything: pages
 * load exactly as they would without it.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

/**
 * Safari (on macOS, and iOS home-screen apps) withdraws push from a site that receives a push
 * without showing a notification, so there every push is shown, even with WOW open.
 */
const mustAlwaysShow =
  /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(self.navigator.userAgent);

const windows = () => self.clients.matchAll({type: "window", includeUncontrolled: true});

self.addEventListener("push", event => {
  let message;
  try {
    message = event.data.json();
  } catch {
    message = {id: "wow", title: "WOW", body: "", url: "/"};
  }
  event.waitUntil(
    (async () => {
      // WOW open and in front of you: the page already pops it up itself.
      if (!mustAlwaysShow) {
        const open = await windows();
        if (open.some(client => client.focused && client.visibilityState === "visible")) return;
      }
      await self.registration.showNotification(message.title, {
        body: message.body,
        // The page's own desktop notification uses the same tag, so it's never shown twice.
        tag: message.id,
        icon: "/icon-192.png",
        data: {url: message.url},
      });
    })()
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin);
  event.waitUntil(
    (async () => {
      if (url.origin !== self.location.origin) {
        await self.clients.openWindow(url.href);
        return;
      }
      // WOW already open: bring it forward and go there in the app (no reload); else open it.
      const client = (await windows()).find(c => new URL(c.url).origin === self.location.origin);
      if (client) {
        await client.focus();
        // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Client.postMessage takes no targetOrigin (same-origin only).
        client.postMessage({type: "wow:navigate", url: url.pathname + url.search});
        return;
      }
      await self.clients.openWindow(url.href);
    })()
  );
});
