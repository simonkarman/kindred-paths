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
import { useState } from 'react';

type TabType = 'table' | 'statistics' | 'text' | 'render';

export function CardOverview(props: {
  title: string,
  cards: SerializedCard[],
  showCreate?: boolean,
}) {
  const { title, showCreate = true } = props;
  const [activeTab, setActiveTab] = useState<TabType>('table');

  const [searchText] = useSearch()
  const deckName = useDeckName();
  const cards = filterCardsBasedOnSearch(props.cards, searchText)
    .filter(c => deckName.trim() === '' || c.tags?.['deck'] === deckName);

  const tabs = [
    { id: 'table' as TabType, label: 'Table View', component: <CardTable cards={cards} /> },
    { id: 'statistics' as TabType, label: 'Statistics', component: <CardsStatistics cards={cards} /> },
    { id: 'text' as TabType, label: 'Text Overview', component: <CardTextOverview cards={cards} /> },
    { id: 'render' as TabType, label: 'Visual Overview', component: <CardRenderOverview cardGroups={[cards]} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-lg mb-2">{title}</h2>
      </div>

      <div className="flex justify-end items-end gap-2">
        <SearchBar />
        {showCreate && (
          <>
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
          </>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}
