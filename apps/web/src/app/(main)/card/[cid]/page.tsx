import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, filterCardsBasedOnSearch } from '@kindred-paths/shared';
import { getCardByCid, getVisibleCards } from '@/core/collection/cards';
import { CardDetailView, type CardDetailFace } from '@/components/card-detail-view';

// Static export builds set `dynamicParams = false` implicitly via `output: 'export'` —
// any cid not returned by generateStaticParams below is a 404 at build time. In dynamic
// builds this export has no effect (routes render on demand as usual).

/**
 * Static export: pre-render one HTML page per card matching the export query. Only invoked
 * by Next during `next build` under `output: 'export'`; in the dynamic dev/build it does
 * nothing (routes are rendered on demand). See docs/v2-phase1d-static-export.md §5.2.
 */
export async function generateStaticParams(): Promise<Array<{ cid: string }>> {
  if (process.env.NEXT_PUBLIC_KP_STATIC !== 'true') return [];
  let cards = await getVisibleCards();
  const exportQuery = process.env.KP_STATIC_EXPORT_QUERY;
  if (exportQuery && exportQuery.trim()) {
    try {
      cards = filterCardsBasedOnSearch(cards, exportQuery);
    } catch {
      // Fall through to unfiltered; matches search/page.tsx behavior.
    }
  }
  return cards.map((card) => ({ cid: card.cid }));
}

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
  // Static export cannot read searchParams at build time. In that mode the initial face
  // is always 0; CardDetailView reads ?face= from window.location on mount to flip if
  // the URL requested face 1. In dynamic mode we read it server-side as before.
  const face = process.env.NEXT_PUBLIC_KP_STATIC === 'true' ? undefined : (await searchParams).face;
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
