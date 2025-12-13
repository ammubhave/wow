import {createSlice, type PayloadAction} from "@reduxjs/toolkit";

export interface LastActivePuzzleState {
  value?: string;
}

const initialState: LastActivePuzzleState = {value: undefined};

export const lastActivePuzzleSlice = createSlice({
  name: "LastActivePuzzle",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<string | undefined>) => {
      state.value = action.payload;
    },
  },
});

export const {set: setLastActivePuzzle} = lastActivePuzzleSlice.actions;

export default lastActivePuzzleSlice.reducer;
