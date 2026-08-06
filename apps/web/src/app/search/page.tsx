import Link from 'next/link';
import { CardGrid } from './card-grid';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link href="/" className="mb-6 inline-block text-xl font-semibold tracking-tight text-navy-700">
        Kindred Paths
      </Link>
      <CardGrid initialQuery={q ?? ''} />
    </main>
  );
}
