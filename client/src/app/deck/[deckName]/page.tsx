import Link from 'next/link';
import type { Metadata } from 'next'
import { Card } from 'kindred-paths';
import { CardRender } from '@/components/card-render';
import { capitalize } from '@/utils/typography';
import { getCards } from '@/utils/server';
import { PageProps } from '@/utils/page-props';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);
const getCount = (card: Card) => typeof card.tags?.['count'] === 'number' ? card.tags['count'] : 1;

export async function generateMetadata({ params: _params }: PageProps<{ deckName: string }>): Promise<Metadata> {
  const params = await _params;
  return {
    title: `KPA: ${capitalize(params.deckName)} Deck`,
  }
}

export default async function DeckOverview({ params: _params }: Readonly<{ params: Promise<{ deckName: string }> }>) {
  const { deckName } = await _params;
  const _cards = await getCards();

  const cards = _cards
    .filter(c => c.tags?.["deleted"] !== true && (deckName === "" || deckName === "*" || c.tags?.["deck"] === deckName))
    .toSorted((a, b) => a.collectorNumber - b.collectorNumber)
    .map(c => new Card(c));

  const totalCount = cards.reduce((acc, card) => acc + getCount(card), 0);

  const manaValueDistribution = cards.reduce((acc, card) => {
    const manaCost = card.manaValue();
    const count = getCount(card);
    if (manaCost === 0) {
      return acc;
    }

    if (manaCost in acc) {
      acc[manaCost] += count;
    } else {
      acc[manaCost] = count;
    }
    return acc;
  }, {} as { [manaValue: number]: number });

  const cardTypeDistribution = cards.reduce((acc, card) => {
    const types = card.types;
    const count = getCount(card);
    if (types.length === 0) {
      return acc;
    }

    types.forEach(type => {
      if (type in acc) {
        acc[type] += count;
      } else {
        acc[type] = count;
      }
    });
    return acc;
  }, {} as { [type: string]: number });

  const subtypeDistribution = cards.reduce((acc, card) => {
    const subtypes = card.subtypes || [];
    const count = getCount(card);
    if (subtypes.length === 0) {
      return acc;
    }

    subtypes.forEach(subtype => {
      if (subtype in acc) {
        acc[subtype] += count;
      } else {
        acc[subtype] = count;
      }
    });
    return acc;
  }, {} as { [subtype: string]: number });

  return <>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <h2 className="font-lg font-bold">{capitalize(deckName)}</h2>
    <p className="text-zinc-500 text-sm italic">This is the deck overview for {deckName}.</p>
    <ul>
      {cards.map(card => (
        <li key={card.id} className="border-b border-zinc-200 py-2">
          {getCount(card)}x{' '}
          <Link href={`/card/${card.id}`} className="text-blue-600 hover:underline">
            #{card.collectorNumber} {card.name}
          </Link>
          {' '}{card.explain()}
        </li>
      ))}
      {cards.length === 0 && (
        <li className="text-zinc-500">No cards in this deck.</li>
      )}
    </ul>
    <p>
      <strong>Total cards:</strong> {totalCount}<br/>
    </p>
    <div className="flex gap-2">
      <div>
        <h2 className="pt-4 font-bold">Mana Value Distribution</h2>
        <pre className="p-1 bg-zinc-50 border border-zinc-200">{JSON.stringify(manaValueDistribution, undefined, 2)}</pre>
      </div>
      <div>
        <h2 className="pt-4 font-bold">Card Type Distribution</h2>
        <pre className="p-1 bg-zinc-50 border border-zinc-200">{JSON.stringify(cardTypeDistribution, undefined, 2)}</pre>
      </div>
      <div>
        <h2 className="pt-4 font-bold">Subtype Distribution</h2>
        <pre className="p-1 bg-zinc-50 border border-zinc-200">{JSON.stringify(subtypeDistribution, undefined, 2)}</pre>
      </div>
    </div>
    <hr className="mb-10 border-zinc-200 break-after-page" />
    <div className="grid grid-cols-3 px-2">
      {cards.filter(c => c.supertype !== "basic").map(card => n(getCount(card)).map(i => <Link key={card.id + i} href={`/edit/${card.id}?t=/deck/${deckName}`}>
        <CardRender serializedCard={card.toJson()} scale={0.6} quality={80} />
      </Link>))}
    </div>
  </>;
};
