/**
 * Redux store — kept minimal. Most state lives close to where it's used;
 * the store only holds cross-cutting concerns (session, workspace, etc.).
 */

import { configureStore } from '@reduxjs/toolkit';
import sessionReducer from './slices/session.slice';
import workspaceReducer from './slices/workspace.slice';
import { persistentWorkspaceMiddleware, loadWorkspaceState } from './middleware/persistent-workspace';

// Pre-load workspace state from localStorage so the user returns to where they left off
const persistedWorkspace = loadWorkspaceState();

export const store = configureStore({
  reducer: {
    session: sessionReducer,
    workspace: workspaceReducer
  },
  preloadedState: persistedWorkspace
    ? { workspace: {
        filters: persistedWorkspace.filters ?? {},
        tableState: persistedWorkspace.tableState ?? {},
        layout: {
          sidebarCollapsed: persistedWorkspace.layout?.sidebarCollapsed ?? false,
          splitViewRatio: persistedWorkspace.layout?.splitViewRatio ?? 0.35
        },
        recentItems: persistedWorkspace.recentItems ?? []
      } }
    : undefined,
  middleware: (getDefault) =>
    getDefault({ serializableCheck: false }).concat(persistentWorkspaceMiddleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
