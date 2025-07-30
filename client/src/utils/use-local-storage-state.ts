import { useEffect, useState } from 'react';

export const useLocalStorageState = <T>(
  key: string,
  initialState: T | (() => T),
): [T, (value: T) => void] => {
  const _initialState = initialState instanceof Function ? initialState() : initialState;
  const [state, setState] = useState<T>(_initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const currentValue = localStorage.getItem(key);
    if (!isHydrated) {
      try {
        setState(currentValue ? JSON.parse(currentValue) : _initialState);
      } finally {
        setIsHydrated(true);
      }
    }
  }, [key, _initialState]);

  const setLocalStorageState = (value: T) => {
    setState(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } finally {}
  }

  return [isHydrated ? state : _initialState, setLocalStorageState];
}
