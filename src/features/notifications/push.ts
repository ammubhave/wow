import {useCallback, useEffect, useEffectEvent, useState} from "react";

import {EXTENSION_ID} from "@/lib/extension";
import {client} from "@/lib/orpc";
import type {PushKind} from "@/server/notifications";

/**
 * Web Push on this device: notifications from WOW even when it isn't open (or, installed as an
 * app, isn't running). The service worker (public/sw.js) shows them; the server
 * (src/server/push.ts) sends them to the devices that subscribed here.
 */

const VAPID_KEY: string | undefined = import.meta.env.VITE_PUBLIC_VAPID_KEY || undefined;
const SERVICE_WORKER = "/sw.js";

/**
 * - `unsupported`: this browser can't (or WOW has no push key).
 * - `needsInstall`: an iPhone or iPad, where only WOW added to the Home Screen can get pushes.
 * - `blocked`: you (or the browser) said no to notifications for WOW.
 * - `off` / `on`: whether this device is subscribed.
 */
export type PushStatus = "loading" | "unsupported" | "needsInstall" | "blocked" | "off" | "on";

const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPadOS says it's a Mac; a Mac has no touch screen.
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

/** Running as an installed app (from the Home Screen, or installed from Chrome). */
export const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator && navigator.standalone === true);

const isSupported = () =>
  VAPID_KEY !== undefined &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

/**
 * Registers the service worker, so WOW can be installed as an app and get pushes, and goes where a
 * clicked notification points when it asks this page to (`wow:navigate`, a path in WOW).
 */
export function useServiceWorker(navigate: (path: string) => void) {
  const onNavigate = useEffectEvent(navigate);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    void (async () => {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER);
      // On every visit, so the extension hears when push was turned off or withdrawn meanwhile.
      const granted = "Notification" in window && Notification.permission === "granted";
      const subscription = granted ? await registration.pushManager?.getSubscription() : null;
      tellExtension(subscription?.endpoint ?? null);
    })().catch((error: unknown) => {
      console.warn("Couldn't register the service worker", error);
    });
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data;
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === "wow:navigate" &&
        "url" in data &&
        typeof data.url === "string" &&
        data.url.startsWith("/") &&
        !data.url.startsWith("//")
      ) {
        onNavigate(data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
}

/**
 * Tells WOW's Chrome extension, if it's installed, this browser's push subscription (null: none),
 * so it doesn't show the @mentions push already brings a second time.
 */
function tellExtension(endpoint: string | null) {
  const runtime: unknown = Reflect.get(Reflect.get(globalThis, "chrome") ?? {}, "runtime");
  const send: unknown = runtime && Reflect.get(runtime, "sendMessage");
  if (typeof send !== "function") return;
  try {
    // A promise in Chrome, rejected when the extension isn't installed: nothing to tell then.
    const sent: unknown = send.call(runtime, EXTENSION_ID, {type: "webPush", endpoint});
    if (sent instanceof Promise) sent.catch(() => undefined);
  } catch {
    // Not installed.
  }
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER);
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Tells WOW about this device's subscription, and what it wants (adds or updates it). */
async function save(subscription: PushSubscription, kinds: PushKind[]) {
  const {endpoint, keys} = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("The browser gave no push keys.");
  await client.push.subscribe({endpoint, p256dh: keys.p256dh, auth: keys.auth, kinds});
}

/**
 * This device's push status, and turning it on and off. While it's on, `kinds` (the bell's
 * settings here; keep the array the same while they are) are kept in step on the server, and so
 * is the subscription itself, which browsers sometimes replace.
 */
export function usePush(kinds: PushKind[]) {
  const [status, setStatus] = useState<PushStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const subscription =
        isSupported() && Notification.permission === "granted" ? await currentSubscription() : null;
      const next: PushStatus = !isSupported()
        ? isIos() && !isInstalled()
          ? "needsInstall"
          : "unsupported"
        : Notification.permission === "denied"
          ? "blocked"
          : subscription
            ? "on"
            : "off";
      tellExtension(subscription?.endpoint ?? null);
      if (!cancelled) setStatus(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the server up to date while it's on.
  useEffect(() => {
    if (status !== "on") return;
    void (async () => {
      const subscription = await currentSubscription();
      if (subscription) await save(subscription, kinds);
    })().catch((error: unknown) => console.warn("Couldn't update push notifications", error));
  }, [status, kinds]);

  const enable = useCallback(async () => {
    if (!VAPID_KEY) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "blocked" : "off");
      return;
    }
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER);
    await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(VAPID_KEY),
      }));
    await save(subscription, kinds);
    tellExtension(subscription.endpoint);
    setStatus("on");
  }, [kinds]);

  const disable = useCallback(async () => {
    const subscription = await currentSubscription();
    if (subscription) {
      await client.push.unsubscribe({endpoint: subscription.endpoint});
      await subscription.unsubscribe();
    }
    tellExtension(null);
    setStatus("off");
  }, []);

  return {status, enable, disable};
}

/**
 * Signing out: this device stops getting your pushes. Whoever signs in next turns them on for
 * themselves if they want them.
 */
export async function forgetPushOnSignOut() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const subscription = await currentSubscription().catch(() => null);
  if (!subscription) return;
  tellExtension(null);
  await client.push.unsubscribe({endpoint: subscription.endpoint}).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}

/** What Chrome hands the page when it could install WOW as an app (not yet in TypeScript's DOM). */
type InstallPromptEvent = Event & {prompt: () => Promise<{outcome: "accepted" | "dismissed"}>};
const isInstallPrompt = (event: Event): event is InstallPromptEvent =>
  "prompt" in event && typeof event.prompt === "function";

// Chrome offers this once, early (often before anything that would show an Install button), so
// it's kept from the start.
let installPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    if (!isInstallPrompt(event)) return;
    event.preventDefault(); // WOW shows its own button instead of the browser's mini-bar.
    installPrompt = event;
    for (const listener of installListeners) listener();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    for (const listener of installListeners) listener();
  });
}

/** Installing WOW as an app, where the browser offers it (Chrome, Edge; not Safari). */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(() => installPrompt);
  useEffect(() => {
    const update = () => setPrompt(installPrompt);
    installListeners.add(update);
    return () => void installListeners.delete(update);
  }, []);
  if (!prompt) return null;
  return async () => {
    const {outcome} = await prompt.prompt();
    if (outcome === "accepted") installPrompt = null;
    setPrompt(installPrompt);
  };
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
