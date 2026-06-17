/**
 * UndoManager — reverses mutations using before/after snapshots.
 *
 * Hooks into the global "el:undo" event and pushes undo entries whenever
 * the user performs a destructive action. Renders a floating toast at the
 * bottom of the screen showing the most recent undoable action.
 */

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Undo2, RotateCcw } from 'lucide-react';

interface UndoEntry {
  id: string;
  label: string;
  undo: () => Promise<void>;
  timestamp: number;
}

interface UndoContextValue {
  push: (entry: Omit<UndoEntry, 'id' | 'timestamp'>) => void;
  canUndo: boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

export function useUndo() {
  const ctx = useContext(UndoContext);
  return ctx;
}

interface UndoManagerProps {
  children: ReactNode;
}

export function UndoManager({ children }: UndoManagerProps) {
  const [stack, setStack] = useState<UndoEntry[]>([]);
  const [visible, setVisible] = useState(false);

  const push = useCallback((entry: Omit<UndoEntry, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).slice(2);
    const timestamp = Date.now();
    setStack((s) => [...s, { ...entry, id, timestamp }]);
    setVisible(true);
    setTimeout(() => setVisible(false), 6000);
  }, []);

  const undoLast = useCallback(async () => {
    const entry = stack[stack.length - 1];
    if (!entry) return;
    try {
      await entry.undo();
      setStack((s) => s.filter((e) => e.id !== entry.id));
      setVisible(false);
    } catch (err) {
      console.error('Undo failed', err);
    }
  }, [stack]);

  // Keyboard: Cmd+Z
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undoLast]);

  return (
    <UndoContext.Provider value={{ push, canUndo: stack.length > 0 }}>
      {children}
      {visible && stack.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--space-6)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-3) var(--space-4)',
            boxShadow: 'var(--shadow-xl), var(--shadow-glow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            zIndex: 'var(--z-toast)',
            animation: 'slideInUp var(--duration-base) var(--ease-spring)'
          }}
        >
          <Undo2 size={16} style={{ color: 'var(--color-primary-blue)' }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              {stack[stack.length - 1].label}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              Click undo or press ⌘Z
            </div>
          </div>
          <button className="el-btn el-btn--primary el-btn--sm" onClick={undoLast}>
            <RotateCcw size={14} />
            Undo
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}
