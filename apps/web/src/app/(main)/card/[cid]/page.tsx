import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card } from '@kindred-paths/shared';
import { getCardByCid } from '@/core/collection/cards';
import { CardDetailView, type CardDetailFace } from '@/components/card-detail-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cid: string }>;
}): Promise<Metadata> {
  const { cid } = await params;
  const serializedCard = await getCardByCid(cid);
  if (!serializedCard) return {};

  const card = new Card(serializedCard);
  const title = card.faces.map((face) => face.name).join(' // ');
  return { title };
}

export default async function CardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ face?: string }>;
}) {
  const { cid } = await params;
  const { face } = await searchParams;
  const serializedCard = await getCardByCid(cid);
  if (!serializedCard) notFound();

  const card = new Card(serializedCard);
  const isDual = card.layout.isDualRenderLayout();
  const faces: CardDetailFace[] = card.faces.map((face) => ({
    name: face.name,
    typeLine: face.renderTypeLine(),
    manaCost: face.renderManaCost(),
    rules: face.rules,
    pt: face.pt,
    loyalty: face.loyalty,
  }));
  const set = card.getTagAsString('set');

  const parsedFace = Number(face);
  const initialFaceIndex = isDual && Number.isInteger(parsedFace) && parsedFace > 0 && parsedFace < faces.length
    ? parsedFace
    : 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <CardDetailView cid={card.cid} faces={faces} isDual={isDual} set={set} initialFaceIndex={initialFaceIndex} />
    </main>
  );
}
