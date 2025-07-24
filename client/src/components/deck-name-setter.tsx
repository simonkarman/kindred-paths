"use client";

import { useLocalStorageState } from '@/utils/use-local-storage-state';
import Link from 'next/link';

const initialValue = '*';
const localStorageKey = 'deckName';

export function DeckNameSetter() {
  const [deckName, setDeckName] = useLocalStorageState<string>(localStorageKey, initialValue);

  return <>
    <div className="flex items-baseline border-b mb-2 pb-2 border-gray-200 gap-4 px-2">
      <label htmlFor="deck-name" className="text-gray-700">Deck Name</label>
      <input
        id="deck-name"
        type="text"
        value={deckName}
        onChange={(e) => setDeckName(e.target.value)}
        className="border border-gray-300 rounded p-1"
      />
    </div>
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-gray-500 max-w-60">When set, new cards will be created with a "deck" tag with this value and cards will be automatically filtered.</p>
      <Link
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        href={"/deck/" + encodeURIComponent(deckName)}
      >
        View
      </Link>
    </div>
  </>
}

export function useDeckName() {
  return useLocalStorageState(localStorageKey, initialValue)[0];
}
