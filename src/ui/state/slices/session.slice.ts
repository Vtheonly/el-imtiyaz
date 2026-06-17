/**
 * Session slice — current user, role, active academic year.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserRole } from '@core/enums';

interface SessionState {
  employeeId: string | null;
  employeeName: string | null;
  role: UserRole | null;
  activeAcademicYearId: string | null;
  isAuthenticated: boolean;
}

const initialState: SessionState = {
  employeeId: null,
  employeeName: null,
  role: UserRole.SUPER_ADMIN,    // v1: assume admin for local desktop use
  activeAcademicYearId: null,
  isAuthenticated: true
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<Partial<SessionState>>) {
      Object.assign(state, action.payload);
    },
    clearSession(state) {
      Object.assign(state, {
        employeeId: null,
        employeeName: null,
        role: null,
        activeAcademicYearId: null,
        isAuthenticated: false
      });
    }
  }
});

export const { setSession, clearSession } = sessionSlice.actions;
export default sessionSlice.reducer;
