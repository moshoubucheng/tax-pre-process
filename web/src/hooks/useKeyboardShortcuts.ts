import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if user is typing in an input/textarea (except for specific shortcuts)
      const target = event.target as HTMLElement;
      const isInputElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // For Ctrl+S, always allow (save)
          // For Enter, only allow when not in input
          // For arrow keys and Esc, always allow
          const alwaysAllowed =
            shortcut.ctrl ||
            shortcut.key === 'Escape' ||
            shortcut.key === 'ArrowLeft' ||
            shortcut.key === 'ArrowRight' ||
            shortcut.key === 'ArrowUp' ||
            shortcut.key === 'ArrowDown';

          if (isInputElement && !alwaysAllowed) {
            continue;
          }

          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcut presets
export const REVIEW_SHORTCUTS = {
  CONFIRM_NEXT: { key: 'Enter', preventDefault: true },
  ESCAPE: { key: 'Escape', preventDefault: true },
  PREV: { key: 'ArrowUp', preventDefault: true },
  NEXT: { key: 'ArrowDown', preventDefault: true },
  HOLD: { key: 'ArrowLeft', preventDefault: true },
  CONFIRM: { key: 'ArrowRight', preventDefault: true },
  SAVE: { key: 's', ctrl: true, preventDefault: true },
} as const;
