import { getCard } from '@/utils/server';
import Link from 'next/link';
import { CardEditor } from '@/components/editor/card-editor';
import { PageProps } from '@/utils/page-props';
import type { Metadata } from 'next';

export async function generateMetadata({ params: _params }: PageProps<{ id: string }>): Promise<Metadata> {
  const params = await _params;
  const card = await getCard(params.id);
  return {
    title: `KPA: Clone ${card?.name ?? params.id}`,
  }
}

export default async function CardClone({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.id);
  if (!serializedCard) {
    return <h1 className="text-red-500">Card not found</h1>;
  }
  return (<>
    <p className="px-2 flex gap-4">
      <Link href={`/card/${serializedCard.id}`} className="underline text-blue-600">View Original {serializedCard.name}</Link>
    </p>
    <div className="flex items-start gap-4">
      <CardEditor start={{ ...serializedCard, name: `${serializedCard.name} (clone)`, id: '<new>' }} />
    </div>
  </>);
}
