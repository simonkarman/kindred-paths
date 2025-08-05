import { useEffect, useState } from 'react';

export const useLocalStorageState = <T>(
  key: string,
  initialState: T | (() => T),
): [T, (value: T) => void] => {
  const _initialState = initialState instanceof Function ? initialState() : initialState;
  const [state, setState] = useState<T>(_initialState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate the state from localStorage on initial render or when the key or initial state changes
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

  // Set up an interval to check for changes in localStorage
  useEffect(() => {
    const t = setInterval(() => {
      const currentValue = localStorage.getItem(key);
      console.info(`currentValue of ${key}`, currentValue);
      setState((prevState) => {
        if (currentValue !== JSON.stringify(prevState)) {
          return currentValue === null ? initialState : JSON.parse(currentValue);
        }
        return prevState;
      });
    }, 300);
    return () => {
      clearInterval(t);
    };
  }, []);

  // Function to set the localStorage state and update the component state
  const setLocalStorageState = (value: T) => {
    setState(value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } finally {}
  }

  return [isHydrated ? state : _initialState, setLocalStorageState];
}
