/**
 * Workspace slice — UI workspace state (filters, table state, layout).
 * Persisted to localStorage via the persistentWorkspace middleware.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface WorkspaceState {
  filters: Record<string, Record<string, unknown>>;   // by route
  tableState: Record<string, { sortField?: string; sortDir?: 'asc' | 'desc'; selectedIds?: string[] }>;
  layout: {
    sidebarCollapsed: boolean;
    activeTab?: string;
    splitViewRatio: number;
  };
  recentItems: Array<{ type: string; id: string; label: string; timestamp: string }>;
}

const initialState: WorkspaceState = {
  filters: {},
  tableState: {},
  layout: {
    sidebarCollapsed: false,
    splitViewRatio: 0.35
  },
  recentItems: []
};

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setFilter: {
      reducer(state, action: PayloadAction<{ route: string; key: string; value: unknown }>) {
        if (!state.filters[action.payload.route]) state.filters[action.payload.route] = {};
        state.filters[action.payload.route][action.payload.key] = action.payload.value;
      },
      prepare: (route: string, key: string, value: unknown) => ({
        payload: { route, key, value },
        meta: { workspace: true }
      })
    },
    clearFilters(state, action: PayloadAction<string>) {
      delete state.filters[action.payload];
    },
    setTableState: {
      reducer(state, action: PayloadAction<{ route: string; sortField?: string; sortDir?: 'asc' | 'desc'; selectedIds?: string[] }>) {
        state.tableState[action.payload.route] = {
          sortField: action.payload.sortField,
          sortDir: action.payload.sortDir,
          selectedIds: action.payload.selectedIds
        };
      },
      prepare: (route: string, tableState: { sortField?: string; sortDir?: 'asc' | 'desc'; selectedIds?: string[] }) => ({
        payload: { route, ...tableState },
        meta: { workspace: true }
      })
    },
    toggleSidebar(state) {
      state.layout.sidebarCollapsed = !state.layout.sidebarCollapsed;
    },
    setSplitViewRatio: {
      reducer(state, action: PayloadAction<number>) {
        state.layout.splitViewRatio = action.payload;
      },
      prepare: (ratio: number) => ({ payload: ratio, meta: { workspace: true } })
    },
    addRecentItem: {
      reducer(state, action: PayloadAction<{ type: string; id: string; label: string; timestamp: string }>) {
        // Dedupe by id
        state.recentItems = state.recentItems.filter((r) => r.id !== action.payload.id);
        // Add to front, cap at 20
        state.recentItems.unshift(action.payload);
        state.recentItems = state.recentItems.slice(0, 20);
      },
      prepare: (item: { type: string; id: string; label: string }) => ({
        payload: { ...item, timestamp: new Date().toISOString() },
        meta: { workspace: true }
      })
    }
  }
});

export const {
  setFilter, clearFilters, setTableState,
  toggleSidebar, setSplitViewRatio, addRecentItem
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
