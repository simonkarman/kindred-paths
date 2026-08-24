'use client';

import { RefObject, useEffect } from 'react';

// Trick to update a React-controlled <input>'s value programmatically in a way that React's
// onChange still picks up (so component state stays in sync) — directly setting `.value`
// bypasses React's tracked value and onChange would never fire.
function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Focuses the given input ref when the user presses Cmd+F (macOS) or Ctrl+F (Windows/Linux),
 * intercepting the browser's native "find in page" shortcut. Rather than selecting the
 * existing text (which would wipe it out on the next keystroke), the cursor is placed at the
 * end of the current search — appending a trailing space first if there isn't one already —
 * so typing immediately continues refining the current search.
 */
export function useSearchShortcut(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        if (input.value.length > 0 && !input.value.endsWith(' ')) {
          setNativeInputValue(input, `${input.value} `);
        }
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef]);
}
