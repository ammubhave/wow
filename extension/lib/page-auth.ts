import {useSyncExternalStore} from "react";

import {apiTokenChanged, setApiEndpoint} from "@/lib/api-endpoint";

import {ask, type ExtensionUser} from "./messages";

/**
 * Signing in, in the extension's own pages (the sidebar and the popup). The background holds the
 * tokens; a page keeps the current access token in memory, points the shared API code at WOW with
 * it (see src/lib/api-endpoint.ts), and asks for a new one shortly before it expires, or when you
 * sign in or out elsewhere.
 */

type Current = {token: string; expiresAt: number; user: ExtensionUser} | null;

let current: Current | undefined;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Ask again this long before the token expires (the background refreshes it if needed). */
const RENEW_EARLY_MS = 60 * 1000;

async function update() {
  const next = await ask({type: "getAccessToken"});
  current = next;
  apiTokenChanged();
  clearTimeout(timer);
  if (next) {
    timer = setTimeout(
      () => void update(),
      Math.max(5_000, next.expiresAt - Date.now() - RENEW_EARLY_MS)
    );
  }
  for (const listener of listeners) listener();
  return next;
}

let started: Promise<Current> | undefined;

/** Sets up the API with the extension's sign-in; resolves to who's signed in (null: nobody). */
export function startPageAuth() {
  started ??= (async () => {
    setApiEndpoint({origin: import.meta.env.WOW_ORIGIN, accessToken: () => current?.token});
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && "auth" in changes) void update();
    });
    // Back from sleep or a hidden tab, the timer may have slept through the expiry.
    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "visible" &&
        current &&
        current.expiresAt - Date.now() < RENEW_EARLY_MS
      ) {
        void update();
      }
    });
    return update();
  })();
  return started;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Who's signed in to the extension: undefined while finding out, null when nobody. */
export function useExtensionUser(): ExtensionUser | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (current === undefined ? undefined : (current?.user ?? null)),
    () => undefined
  );
}

export async function signIn() {
  const result = await ask({type: "signIn"});
  if ("error" in result) throw new Error(result.error);
  await update();
  return result.user;
}

export async function signOut() {
  await ask({type: "signOut"});
  await update();
}
