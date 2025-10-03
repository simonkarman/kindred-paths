import { getCards, getSet } from '@/utils/server';
import { SerializableSet } from 'kindred-paths';
import { SetEditor } from '@/components/set-editor/set-editor';
import { PageProps } from '@/utils/page-props';
import type { Metadata } from 'next';

export async function generateMetadata({ params: _params }: PageProps<{ name: string }>): Promise<Metadata> {
  const params = await _params;
  const set = await getSet(params.name);
  return {
    title: `KPA: Edit ${set?.name ?? params.name}`,
  }
}

export default async function Page({ params: _params }: Readonly<{ params: Promise<{ name: string }> }>) {
  const params = await _params;
  const set: SerializableSet | null = await getSet(params.name);
  if (!set) {
    return <h2 className="text-red-500">Set {params.name} not found.</h2>;
  }

  const cards = await getCards();
  return <SetEditor set={set} cards={cards} />;
}
