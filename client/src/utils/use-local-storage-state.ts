import { useEffect, useState } from 'react';

export const useLocalStorageState = <T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: T) => void] => {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue instanceof Function ? initialValue() : initialValue;
    }
    const storedValue = localStorage.getItem(key);
    return storedValue
      ? JSON.parse(storedValue)
      : (initialValue instanceof Function ? initialValue() : initialValue);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
