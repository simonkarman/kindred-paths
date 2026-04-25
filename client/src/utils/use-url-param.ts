'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Read and write a single URL query parameter.
 * - Local state is updated immediately for instant visual feedback.
 * - URL is updated via window.history.replaceState (no server round-trip).
 * - Syncs back from useSearchParams on browser back/forward navigation.
 * - When the value equals the default, the param is omitted from the URL.
 */
export function useUrlParam(key: string, defaultValue: string): [string, (value: string) => void] {
  const searchParams = useSearchParams();

  const [value, setValueLocal] = useState(searchParams.get(key) ?? defaultValue);

  // Sync from router on back/forward navigation
  useEffect(() => {
    setValueLocal(searchParams.get(key) ?? defaultValue);
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback((newValue: string) => {
    // Update local state immediately — no delay
    setValueLocal(newValue);
    // Update URL without triggering a Next.js navigation/re-render
    const params = new URLSearchParams(window.location.search);
    if (newValue === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, newValue);
    }
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : ''));
  }, [key, defaultValue]);

  return [value, setValue];
}
