import Link from 'next/link';
import type { Metadata } from 'next'
import { Card, getStatistics } from 'kindred-paths';
import { CardRender } from '@/components/card-render';
import { capitalize } from '@/utils/typography';
import { getCards } from '@/utils/server';
import { PageProps } from '@/utils/page-props';
import { CardsStatistics } from '@/components/cards-statistics';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

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

  const { cardsWithoutTokensAndBasicLands, basicLands, tokens } = getStatistics(cardsIncludingTokens);

  return <>
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold">Deck: {capitalize(deckName)}</h2>
      </div>

      {/* Stats */}
      <CardsStatistics cards={cardsIncludingTokens} />

      {/* Text info (print-only) */}
      <ul className="not-print:hidden grid grid-cols-2 py-2 gap-y-1 gap-x-4">
        {cardsIncludingTokens.map(c => {
          const card = new Card(c);
          return (
            <li key={card.id} className="border-b border-zinc-100 py-2">
              {card.getTagAsNumber('count')}x{' '}
              <Link href={`/card/${card.id}`} className="text-blue-600 hover:underline">
                #{card.collectorNumber} {card.name}
              </Link><br/>
              <span className="text-xs text-zinc-600">is {card.explain({ withoutName: true })}</span>
            </li>
          )
        })}
        {cardsIncludingTokens.length === 0 && (
          <li className="text-zinc-500">No cards in this deck.</li>
        )}
      </ul>
      <hr className="mb-10 border-zinc-50 break-after-page" />
    </div>

    {/* Card Renders */}
    <div className="grid grid-cols-3">
      {[cardsWithoutTokensAndBasicLands, basicLands, tokens].map((group, groupIndex) => group
        .map(card => n(card.getTagAsNumber("count") ?? 0)
          .map(i => <Link className="border-3 bg-zinc-500" key={groupIndex + card.id + i} href={`/edit/${card.id}?t=/print/${deckName}`}>
            <CardRender serializedCard={card.toJson()} scale={0.6} quality={80} />
          </Link>
        )
      ))}
    </div>
  </>;
};
