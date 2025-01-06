import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface IsCollapsedState {
  map: { [id: string]: boolean };
}

const IS_COLLAPSED = "isCollapsed";

const initialState: IsCollapsedState = {
  map: JSON.parse(localStorage.getItem(IS_COLLAPSED) ?? "null") ?? {},
};

interface IsCollapsedValue {
  id: string;
  isCollapsed: boolean;
}

export const isCollapsedSlice = createSlice({
  name: "IsCollapsed",
  initialState,
  reducers: {
    set: (state, action: PayloadAction<IsCollapsedValue>) => {
      state.map[action.payload.id] = action.payload.isCollapsed;
      localStorage.setItem(IS_COLLAPSED, JSON.stringify(state.map));
    },
  },
});

export const { set: setIsCollapsedState } = isCollapsedSlice.actions;

export default isCollapsedSlice.reducer;
