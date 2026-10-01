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
      // Each message carries the full map; only replace entries whose users changed so unchanged
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
  },
});

export const {set: setPresences} = presencesSlice.actions;

export default presencesSlice.reducer;
