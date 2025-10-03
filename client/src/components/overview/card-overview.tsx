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
import { useLocalStorageState } from '@/utils/use-local-storage-state';

type TabType = 'table' | 'statistics' | 'text' | 'visual';

export function CardOverview(props: {
  cards: SerializedCard[],
  showCreate?: boolean,
}) {
  const { showCreate = true } = props;
  const [activeTab, setActiveTab] = useLocalStorageState<TabType>('home/tab', 'table');

  const [searchText] = useSearch('home');
  const cards = filterCardsBasedOnSearch(props.cards, searchText);

  const tabs = [
    { id: 'table' as TabType, label: 'Table', component: <TableTab cards={cards} /> },
    { id: 'visual' as TabType, label: 'Visual', component: <VisualTab
        cards={cards}
        dynamicLink={c => `/edit/${c.id}?t=/`} />
    },
    { id: 'text' as TabType, label: 'Text', component: <TextTab cards={cards} /> },
    { id: 'statistics' as TabType, label: 'Statistics', component: <StatisticsTab cards={cards} /> },
  ];

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 print:px-1.5">
      <div className="max-w-7xl mx-auto">
        {/* Header Section with Tabs and Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6 overflow-hidden">
          {/* Top Bar with Search and Actions */}
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="flex justify-end gap-2 w-full shrink">
                <SearchBar scope="home" />
              </div>
              {showCreate && (
                <div className="shrink-0 flex gap-2 justify-end">
                  <Link
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
                    href="/create?t=/"
                  >
                    Create New Card
                  </Link>
                  <Link
                    className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 active:from-purple-800 active:to-blue-800 transition-all shadow-sm"
                    href="/generate"
                  >
                    <FontAwesomeIcon
                      icon={faWandMagicSparkles}
                      className="mr-2"
                    />
                    Inspire Me!
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="px-6">
            <nav className="flex space-x-8 -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto">
          {tabs.find(tab => tab.id === activeTab)?.component}
        </div>
      </div>
    </div>
  );
}
