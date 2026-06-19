import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { UserRole } from "../../../core/enums";

interface SessionState {
  employeeId: string | null;
  employeeName: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  activeAcademicYearId: string | null;
}

const initialState: SessionState = {
  employeeId: null,
  employeeName: null,
  role: null,
  isAuthenticated: false,
  activeAcademicYearId: null,
};

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Partial<SessionState>>) {
      Object.assign(state, action.payload);
    },
    clearSession(state) {
      state.employeeId = null;
      state.employeeName = null;
      state.role = null;
      state.isAuthenticated = false;
      state.activeAcademicYearId = null;
    },
  },
});

export const { setSession, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
