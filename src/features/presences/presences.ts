import {createSlice, type PayloadAction} from "@reduxjs/toolkit";

export interface PresenceState {
  value: Record<string, string[]>;
}

const initialState: PresenceState = {value: {}};

export const presencesSlice = createSlice({
  name: "Presences",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<Record<string, string[]>>) => {
      state.value = action.payload;
    },
  },
});

export const {set: setPresences} = presencesSlice.actions;

export default presencesSlice.reducer;
