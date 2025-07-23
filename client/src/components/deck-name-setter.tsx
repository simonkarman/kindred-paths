"use client";

import { useLocalStorageState } from '@/utils/use-local-storage-state';

const initialValue = '*';
const localStorageKey = 'deckName';

export function DeckNameSetter() {
  const [deckName, setDeckName] = useLocalStorageState<string>(localStorageKey, initialValue);

  return <>
    <div className="flex items-center gap-2">
      <label htmlFor="deck-name" className="text-gray-700">Deck Name:</label>
      <input
        id="deck-name"
        type="text"
        value={deckName}
        onChange={(e) => setDeckName(e.target.value)}
        className="border border-gray-300 rounded p-1"
      />
    </div>
    <p className="text-xs text-gray-500 max-w-70">When set, new cards will be created with a "deck" tag with this value and cards will be automatically filtered.</p>
  </>
}

export function useDeckName() {
  return useLocalStorageState(localStorageKey, initialValue)[0];
}
