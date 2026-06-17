/**
 * Persistent Workspace State — Redux middleware that saves UI workspace
 * state (filters, open tabs, selections, table sort, column order) to
 * localStorage so the user returns to exactly where they left off.
 *
 * This is one of the most under-rated UX features for admin tools — it
 * eliminates the frustration of re-applying filters every time you
 * navigate away and back.
 *
 * Usage:
 *   configureStore({
 *     reducer: ...,
 *     middleware: (getDefault) => getDefault().concat(persistentWorkspace)
 *   })
 *
 * Actions tagged with `meta.workspace: true` are persisted. State is
 * rehydrated on app start via `loadWorkspaceState()`.
 */

import { Middleware } from '@reduxjs/toolkit';

const STORAGE_KEY = 'el-imtiyaz:workspace-state';
const PERSIST_DEBOUNCE_MS = 500;

interface Persistable {
  filters?: Record<string, unknown>;
  tableState?: Record<string, { sortField?: string; sortDir?: 'asc' | 'desc'; selectedIds?: string[] }>;
  layout?: {
    sidebarCollapsed?: boolean;
    activeTab?: string;
    splitViewRatio?: number;
  };
  recentItems?: Array<{ type: string; id: string; label: string; timestamp: string }>;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: Persistable = {};

/**
 * Middleware that captures workspace actions and queues a debounced save.
 */
export const persistentWorkspaceMiddleware: Middleware = (store) => (next) => (action) => {
  // Pass through first so the reducer updates state
  const result = next(action);

  // Check if action is workspace-related (by convention: meta.workspace or action type prefix)
  const typed = action as { meta?: { workspace?: boolean }; type?: string };
  if (
    typed?.meta?.workspace ||
    (typeof typed?.type === 'string' && typed.type.startsWith('workspace/'))
  ) {
    pendingState = extractPersistable(store.getState());
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingState));
      } catch (err) {
        console.warn('Failed to persist workspace state', err);
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  return result;
};

/**
 * Pull only persistable fields from the root state.
 */
function extractPersistable(rootState: unknown): Persistable {
  const s = rootState as { workspace?: Persistable };
  return s.workspace ?? {};
}

/**
 * Load the persisted workspace state on app boot.
 */
export function loadWorkspaceState(): Persistable | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persistable;
  } catch {
    return null;
  }
}

/**
 * Clear the persisted state (used by Settings → Reset Layout).
 */
export function clearWorkspaceState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
