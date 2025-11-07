import { getSets } from '@/utils/server';
import Link from 'next/link';
import CreateNewSetForm from '@/app/set/create-new-set-form';

export default async function Page() {
  const sets = await getSets();
  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-slate-900 mb-2">
          All Sets
        </h2>
        <p className="text-slate-600">
          Browse and manage your sets
        </p>
      </div>

      {/* Sets Grid */}
      {sets.length > 0 ? (
        <div className="grid gap-4 mb-4">
          {sets.sort((a, b) => a.name.localeCompare(b.name)).map(set => (
            <Link
              key={set.name}
              href={`/set/${set.name}`}
              className="group block bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 border border-slate-200 hover:border-blue-300"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {set.name}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    ({set.matricesCount}#){' '}
                    {set.validCardCount} /{' '}
                    {set.cardCount} {set.cardCount === 1 ? 'card' : 'cards'}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8 border border-slate-200 text-center">
          <p className="text-slate-500">
            No sets yet. Create your first set below!
          </p>
        </div>
      )}

      {/* Create New Set Section */}
      <div className="bg-blue-50 rounded-lg shadow-sm p-6 border border-blue-200">
        <h3 className="text-lg text-slate-900 mb-4">
          ... or create a new set
        </h3>
        <CreateNewSetForm />
      </div>
    </div>
  );
}
