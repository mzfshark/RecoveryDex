// src/store/reducers/tokens.reducer.js
import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  tokens: [],
  error: null,
};

const tokensSlice = createSlice({
  name: "tokens",
  initialState,
  reducers: {
    tokensLoaded: (state, action) => {
      state.tokens = action.payload;
    },
    tokensLoadError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const { tokensLoaded, tokensLoadError } = tokensSlice.actions;
export default tokensSlice.reducer;
