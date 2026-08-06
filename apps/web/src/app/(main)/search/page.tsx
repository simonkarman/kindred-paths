import { CardGrid } from './card-grid';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <CardGrid initialQuery={q ?? ''} />
    </main>
  );
}
