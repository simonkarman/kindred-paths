"use client";

import { useLocalStorageState } from '@/utils/use-local-storage-state';
import Link from 'next/link';
import { capitalize } from '@/utils/typography';

const initialValue = '*';
const localStorageKey = 'deckName';

export function DeckNameSetter() {
  const [deckName, setDeckName] = useLocalStorageState<string>(localStorageKey, initialValue);

  const activeDeckName = deckName.length === 0 ? initialValue : deckName;
  return <>
    <div className="flex gap-4">
      <input
        id="deck-name"
        type="text"
        placeholder="Deck Name"
        value={deckName}
        onChange={(e) => setDeckName(e.target.value)}
        className="text-sm border border-zinc-300 rounded px-2 p-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
      />
      <Link
        className="text-sm bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition-colors"
        href={"/deck/" + encodeURIComponent(activeDeckName)}
      >
        View Deck
      </Link>
    </div>
  </>
}

export function useDeckName() {
  return useLocalStorageState(localStorageKey, initialValue)[0];
}
