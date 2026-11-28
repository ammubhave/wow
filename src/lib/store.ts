import {useSyncExternalStore} from "react";

/**
 * A piece of state shared across the app without a provider (it works the same in the extension).
 * Change it with `update` (return the same state to change nothing); read it with `useStore`.
 */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    update(change: (state: T) => T) {
      const next = change(state);
      if (Object.is(next, state)) return;
      state = next;
      for (const listener of listeners) listener();
    },
  };
}

export type Store<T> = ReturnType<typeof createStore<T>>;

/**
 * The part of a store a component shows; it re-renders only when that part changes. `select` must
 * return the same value for unchanged state (a part of it, never a new object or array).
 */
export function useStore<T, S>(store: Store<T>, select: (state: T) => S): S {
  const snapshot = () => select(store.get());
  return useSyncExternalStore(store.subscribe, snapshot, snapshot);
}
