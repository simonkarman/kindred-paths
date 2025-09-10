import Link from 'next/link';
import type { Metadata } from 'next'
import { getStatistics } from 'kindred-paths';
import { CardRender } from '@/components/card-render';
import { capitalize } from '@/utils/typography';
import { getCards } from '@/utils/server';
import { PageProps } from '@/utils/page-props';
import { CardsStatistics } from '@/components/overview/cards-statistics';
import { CardTextOverview } from '@/components/overview/card-text-overview';
import { CardRenderOverview } from '@/components/overview/card-render-overview';

export async function generateMetadata({ params: _params }: PageProps<{ deckName: string }>): Promise<Metadata> {
  const params = await _params;
  return {
    title: `KPA: Print ${capitalize(params.deckName)} Deck`,
  }
}

export default async function Print({ params: _params }: Readonly<{ params: Promise<{ deckName: string }> }>) {
  const { deckName } = await _params;
  const _cards = await getCards();

  const cardsIncludingTokens = _cards
    .filter(c => deckName === "" || c.tags?.["deck"] === deckName)
    .toSorted((a, b) => a.collectorNumber - b.collectorNumber);

  return <>
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold">Deck: {capitalize(deckName)}</h2>
      </div>

      {/* Stats */}
      <CardsStatistics cards={cardsIncludingTokens} />

      {/* Text info (print-only) */}
      <div className="not-print:hidden">
        <CardTextOverview cards={cardsIncludingTokens} />
      </div>
      <hr className="mb-10 border-zinc-50 break-after-page" />
    </div>

    {/* Card Renders */}
    <CardRenderOverview
      cards={cardsIncludingTokens}
      dynamicLink={(c) => `/edit/${c.id}?t=/print/${deckName}`}
    />
  </>;
};
