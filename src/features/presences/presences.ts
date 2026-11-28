import {createStore, useStore} from "@/lib/store";

type Presence = {id: string; name: string; email: string; image: string | null};

/** Who's where: each location (a puzzle id, or the workspace slug) and the people there. */
const presences = createStore<Record<string, Presence[]>>({});

/** Stable fallback so places with no one don't get a new array (and re-render) each time. */
const NO_PRESENCES: Presence[] = [];

const samePeople = (a: Presence[], b: Presence[]) =>
  a.length === b.length &&
  a.every(
    (u, i) =>
      u.id === b[i]!.id &&
      u.name === b[i]!.name &&
      u.email === b[i]!.email &&
      u.image === b[i]!.image
  );

/**
 * A snapshot carries the full map; places whose people didn't change keep the same array, so
 * their rows don't re-render.
 */
export function setPresences(next: Record<string, Presence[]>) {
  presences.update(current => {
    let changed = Object.keys(current).length !== Object.keys(next).length;
    const result: Record<string, Presence[]> = {};
    for (const [location, people] of Object.entries(next)) {
      const previous = current[location];
      if (previous && samePeople(previous, people)) {
        result[location] = previous;
      } else {
        result[location] = people;
        changed = true;
      }
    }
    return changed ? result : current;
  });
}

/** Someone showed up somewhere (a puzzle, or the workspace itself). */
export function joinPresence({location, user}: {location: string; user: Presence}) {
  presences.update(current => {
    const people = current[location] ?? [];
    if (people.some(u => u.id === user.id)) return current;
    return {...current, [location]: [...people, user]};
  });
}

/** Someone left a place (their last tab there closed). */
export function leavePresence({location, userId}: {location: string; userId: string}) {
  presences.update(current => {
    const people = current[location];
    if (!people?.some(u => u.id === userId)) return current;
    const rest = people.filter(u => u.id !== userId);
    if (rest.length > 0) return {...current, [location]: rest};
    return Object.fromEntries(Object.entries(current).filter(([key]) => key !== location));
  });
}

/** The people at a location (a puzzle id, or the workspace slug). */
export const usePresences = (location: string) =>
  useStore(presences, state => state[location] ?? NO_PRESENCES);
