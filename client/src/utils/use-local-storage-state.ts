import { useEffect, useState } from 'react';

export const useLocalStorageState = <T>(
  key: string,
  initialState: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] => {
  const _initialState = initialState instanceof Function ? initialState() : initialState;
  const [state, setState] = useState<T>(_initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate the state from localStorage on initial render or when the key or initial state changes
  useEffect(() => {
    const currentValue = localStorage.getItem(key);
    if (!isHydrated) {
      try {
        setState(currentValue ? JSON.parse(currentValue) : _initialState);
      } catch {
        setState(_initialState);
      } finally {
        setIsHydrated(true);
      }
    }
  }, [isHydrated, key, _initialState]);

  // Set up an interval to check for changes in localStorage
  useEffect(() => {
    const t = setInterval(() => {
      const currentValue = localStorage.getItem(key);
      setState((prevState) => {
        if (currentValue !== JSON.stringify(prevState)) {
          return currentValue === null || currentValue === undefined ? _initialState : JSON.parse(currentValue);
        }
        return prevState;
      });
    }, 300);
    return () => {
      clearInterval(t);
    };
  }, [key, _initialState]);

  // Function to set the localStorage state and update the component state
  const setLocalStorageState = (value: T | ((prev: T) => T)) => {
    const valueToStore = value instanceof Function ? value(state) : value;
    setState(valueToStore);
    try {
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } finally {}
  }

  return [isHydrated ? state : _initialState, setLocalStorageState];
}
