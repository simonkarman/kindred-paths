"use client";

import { CardTable } from '@/components/overview/card-table';
import Link from 'next/link';
import SearchBar from '@/components/search-bar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { CardsStatistics } from '@/components/cards-statistics';
import { filterCardsBasedOnSearch, useSearch } from '@/utils/use-search';
import { SerializedCard } from 'kindred-paths';
import { CardTextOverview } from '@/components/overview/card-text-overview';
import { useDeckName } from '@/components/deck-name-setter';
import { CardRenderOverview } from '@/components/overview/card-render-overview';

export function CardOverview(props: {
  title: string,
  cards: SerializedCard[],
  showCreate?: boolean,
}) {
  const { title, showCreate = true } = props;

  const [searchText] = useSearch()
  const deckName = useDeckName();
  const cards = filterCardsBasedOnSearch(props.cards, searchText)
    .filter(c => deckName.trim() === '' || c.tags?.['deck'] === deckName);


  return (<div className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <h2 className="font-bold text-lg mb-2">{title}</h2>
    </div>
    <div className="flex justify-end items-end gap-2">
      <SearchBar />
      {showCreate && <>
        <Link
          className="grow-0 shrink-0 inline-block text-sm bg-blue-600 text-white px-3 py-1 border border-gray-300 rounded hover:bg-blue-800 active:bg-blue-900"
          href="/create?t=/"
        >
          Create New Card
        </Link>
        <Link
          className="grow-0 shrink-0 inline-block text-sm bg-blue-600 text-white px-3 py-1 border border-gray-300 rounded hover:bg-blue-800 active:bg-blue-900"
          href="/generate"
        >
          <FontAwesomeIcon
            icon={faWandMagicSparkles}
            className="mr-2"
          />
          Generate Cards
        </Link>
      </>}
    </div>
    <CardTable cards={cards} />
    <CardsStatistics cards={cards} />
    <CardTextOverview cards={cards} />
    <CardRenderOverview cardGroups={[cards]} />
  </div>);
}
