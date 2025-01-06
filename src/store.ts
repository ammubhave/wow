import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import presencesReducer from "./features/presences/presences";
import isCollapsedReducer from "./features/settings/is-collapsed";
import isDarkModeEnabledReducer from "./features/settings/is-dark-mode-enabled";

export const store = configureStore({
  reducer: {
    presences: presencesReducer,
    isDarkModeEnabled: isDarkModeEnabledReducer,
    isCollapsed: isCollapsedReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
