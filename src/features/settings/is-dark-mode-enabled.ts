import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface IsDarkModeEnabledState {
  isDarkModeEnabled: boolean;
}

const DARK_MODE = "isDarkModeEnabled";

const initialState: IsDarkModeEnabledState = {
  isDarkModeEnabled:
    JSON.parse(localStorage.getItem(DARK_MODE) ?? "false") ?? false,
};

export const isDarkModeEnabledSlice = createSlice({
  name: "IsDarkModeEnabled",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<boolean>) => {
      state.isDarkModeEnabled = action.payload;
      localStorage.setItem(DARK_MODE, JSON.stringify(state.isDarkModeEnabled));
      if (state.isDarkModeEnabled) {
        if (!document.documentElement.classList.contains("dark")) {
          document.documentElement.classList.add("dark");
        }
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
  },
});

export const { set: setIsDarkModeEnabled } = isDarkModeEnabledSlice.actions;

export default isDarkModeEnabledSlice.reducer;
