import {createSlice, type PayloadAction} from "@reduxjs/toolkit";

export interface PresenceState {
  value: Record<
    string,
    {
      id: string;
      name: string;
      email: string;
      image: string | null;
      displayUsername: string | null;
    }[]
  >;
}

const initialState: PresenceState = {value: {}};

export const presencesSlice = createSlice({
  name: "Presences",
  initialState,
  reducers: {
    set: (
      state,
      action: PayloadAction<
        Record<
          string,
          {
            id: string;
            name: string;
            email: string;
            image: string | null;
            displayUsername: string | null;
          }[]
        >
      >
    ) => {
      state.value = action.payload;
    },
  },
});

export const {set: setPresences} = presencesSlice.actions;

export default presencesSlice.reducer;
