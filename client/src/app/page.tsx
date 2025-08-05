import { getCards } from '@/utils/server';
import { CardTable } from '@/components/card-table';
import Link from 'next/link';
import SearchBar from '@/components/search-bar';

export default async function Home() {
  const cards = await getCards();
  return (<div className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <h2 className="font-bold text-lg mb-2">All Cards</h2>
    </div>
    <div className="flex justify-end items-end gap-2">
      <SearchBar />
      <Link
        className="grow-0 shrink-0 inline-block text-sm bg-blue-600 text-white px-3 py-1 border border-gray-300 rounded hover:bg-blue-800 active:bg-blue-900"
        href="/create?t=/"
      >
        Create New Card
      </Link>
    </div>
    <CardTable cards={cards} />
  </div>);
}
