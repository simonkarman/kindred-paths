import type { Metadata } from 'next';
import { CardGrid } from './card-grid';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const { q } = await searchParams;
  if (!q || !q.trim()) return {};
  return { title: q };
}

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
