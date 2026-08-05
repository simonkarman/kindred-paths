import { CardGrid } from './card-grid';

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Overview</h1>
      <CardGrid initialQuery={q ?? ''} />
    </main>
  );
}
