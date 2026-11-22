import {createSlice, type PayloadAction} from "@reduxjs/toolkit";

type Presence = {id: string; name: string; email: string; image: string | null};

export interface PresenceState {
  value: Record<string, Presence[]>;
}

const initialState: PresenceState = {value: {}};

/** Stable fallback so selectors don't return a new array (and re-render) for puzzles with no one. */
export const NO_PRESENCES: Presence[] = [];

export const presencesSlice = createSlice({
  name: "Presences",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<Record<string, Presence[]>>) => {
      // A snapshot carries the full map; only replace entries whose users changed so unchanged
      // puzzles keep the same array reference and their rows don't re-render.
      for (const id of Object.keys(state.value)) {
        if (!(id in action.payload)) delete state.value[id];
      }
      for (const [id, users] of Object.entries(action.payload)) {
        const prev = state.value[id];
        const unchanged =
          prev?.length === users.length &&
          prev.every(
            (u, i) =>
              u.id === users[i]!.id &&
              u.name === users[i]!.name &&
              u.email === users[i]!.email &&
              u.image === users[i]!.image
          );
        if (!unchanged) {
          state.value[id] = users;
        }
      }
    },
    /** Someone showed up somewhere (a puzzle, or the workspace itself). */
    join: (state, action: PayloadAction<{location: string; user: Presence}>) => {
      const {location, user} = action.payload;
      const people = state.value[location] ?? [];
      if (people.some(u => u.id === user.id)) return;
      state.value[location] = [...people, user];
    },
    /** Someone left a place (their last tab there closed). */
    leave: (state, action: PayloadAction<{location: string; userId: string}>) => {
      const {location, userId} = action.payload;
      const people = state.value[location];
      if (!people?.some(u => u.id === userId)) return;
      const rest = people.filter(u => u.id !== userId);
      if (rest.length > 0) state.value[location] = rest;
      else delete state.value[location];
    },
  },
});

export const {set: setPresences, join: joinPresence, leave: leavePresence} = presencesSlice.actions;

export default presencesSlice.reducer;
