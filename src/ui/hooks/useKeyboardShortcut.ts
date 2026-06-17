/**
 * useKeyboardShortcut — registers a global keyboard shortcut.
 */

import { useEffect } from 'react';

type KeyCombo = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export function useKeyboardShortcut(combo: KeyCombo, handler: () => void) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const metaMatch = combo.meta ? e.metaKey : true;
      const ctrlMatch = combo.ctrl ? e.ctrlKey : true;
      const shiftMatch = combo.shift ? e.shiftKey : true;
      const altMatch = combo.alt ? e.altKey : true;
      const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase();

      if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [combo, handler]);
}
