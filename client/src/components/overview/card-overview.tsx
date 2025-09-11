"use client";

import { TableTab } from '@/components/overview/table-tab';
import Link from 'next/link';
import SearchBar from '@/components/search-bar';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { StatisticsTab } from '@/components/overview/statistics-tab';
import { filterCardsBasedOnSearch, useSearch } from '@/utils/use-search';
import { SerializedCard } from 'kindred-paths';
import { TextTab } from '@/components/overview/text-tab';
import { VisualTab } from '@/components/overview/visual-tab';
import { useState } from 'react';

type TabType = 'table' | 'statistics' | 'text' | 'render';

export function CardOverview(props: {
  cards: SerializedCard[],
  showCreate?: boolean,
}) {
  const { showCreate = true } = props;
  const [activeTab, setActiveTab] = useState<TabType>('table');

  const [searchText] = useSearch()
  const cards = filterCardsBasedOnSearch(props.cards, searchText);

  const tabs = [
    { id: 'table' as TabType, label: 'Table', component: <TableTab cards={cards} /> },
    { id: 'visual' as TabType, label: 'Visual', component: <VisualTab cards={cards} /> },
    { id: 'text' as TabType, label: 'Text', component: <TextTab cards={cards} /> },
    { id: 'statistics' as TabType, label: 'Statistics', component: <StatisticsTab cards={cards} /> },
  ];

  return (
    <div className="space-y-3">

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 flex items-baseline justify-between gap-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="grow flex justify-end items-end gap-2">
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
                Inspire Me!
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {tabs.find(tab => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}
