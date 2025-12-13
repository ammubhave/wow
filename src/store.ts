import {configureStore} from "@reduxjs/toolkit";
import {useDispatch, useSelector} from "react-redux";

import lastActivePuzzleReducer from "./features/lastActivePuzzle/lastActivePuzzle";
import presencesReducer from "./features/presences/presences";

export const store = configureStore({
  reducer: {presences: presencesReducer, lastActivePuzzle: lastActivePuzzleReducer},
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
