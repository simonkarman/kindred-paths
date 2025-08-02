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

const BarDistribution = ({ title, data }: { title: string, data: Record<string, number> }) => {
  const maxValue = Math.max(...Object.values(data));
  return (
    <div>
      <h3 className="font-bold mb-2 text-center">{title}<span className="pl-1 font-normal">Distribution</span></h3>
      <div className="space-y-1 w-70">
        {Object.entries(data)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-sm bg-zinc-50 rounded-l-full border-zinc-200 border">
              <div className="block h-6 w-120 bg-zinc-200/80 rounded-full">
                <div
                  className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-3"
                  style={{ width: `${(value / maxValue) * 75 + 25}%` }}
                >
                  <span className="text-xs text-white font-bold">{value}x</span>
                </div>
              </div>
              <span className="inline-block h-6 font-mono text-right w-full pr-2 py-0.5">{key}</span>
            </div>
          ))}
      </div>
    </div>
  );
};


export default async function DeckOverview({ params: _params }: Readonly<{ params: Promise<{ deckName: string }> }>) {
  const { deckName } = await _params;
  const _cards = await getCards();

  const cardsIncludingTokens = _cards
    .filter(c => c.tags?.["deleted"] !== true && (deckName === "" || deckName === "*" || c.tags?.["deck"] === deckName))
    .toSorted((a, b) => a.collectorNumber - b.collectorNumber)
    .map(c => new Card(c));

  const cardsWithoutTokens = cardsIncludingTokens.filter(c => c.supertype !== "token");
  const tokens = cardsIncludingTokens.filter(c => c.supertype === "token");
  const cardsWithoutTokensAndBasicLands = cardsWithoutTokens.filter(c => c.supertype !== "basic");
  const basicLands = cardsWithoutTokens.filter(c => c.supertype === "basic");

  const totalCount = cardsWithoutTokens.reduce((acc, card) => acc + getCount(card), 0);

  const manaValueDistribution = cardsWithoutTokens
    .filter(c => c.types.length !== 1 || c.types[0] !== "land")
    .reduce((acc, card) => {
      const manaCost = card.manaValue() + ' mana';
      const count = getCount(card);

      if (manaCost in acc) {
        acc[manaCost] += count;
      } else {
        acc[manaCost] = count;
      }
      return acc;
    }, {} as { [manaValue: string]: number });

  const cardTypeDistribution = cardsWithoutTokens.reduce((acc, card) => {
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

  const subtypeDistribution = cardsWithoutTokensAndBasicLands.reduce((acc, card) => {
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
    <div className="space-y-3">
      <div>
        <h2 className="text-2xl font-bold">Deck: {capitalize(deckName)}</h2>
        <p className="text-zinc-500 text-sm italic">Overview of <span className="font-bold">{totalCount}</span> cards in deck "{deckName}".</p>
      </div>
      <div className="flex gap-5 justify-between items-start py-2 break-inside-avoid">
        <BarDistribution title="Mana Value" data={manaValueDistribution} />
        <BarDistribution title="Card Type" data={cardTypeDistribution} />
        <BarDistribution title="Subtype" data={subtypeDistribution} />
      </div>
      <ul className="not-print:hidden grid grid-cols-2 py-2 gap-y-1 gap-x-4">
        {cardsIncludingTokens.map(card => (
          <li key={card.id} className="border-b border-zinc-100 py-2">
            {getCount(card)}x{' '}
            <Link href={`/card/${card.id}`} className="text-blue-600 hover:underline">
              #{card.collectorNumber} {card.name}
            </Link><br/>
            <span className="text-xs text-zinc-600">is {card.explain({ withoutName: true })}</span>
          </li>
        ))}
        {cardsIncludingTokens.length === 0 && (
          <li className="text-zinc-500">No cards in this deck.</li>
        )}
      </ul>
      <hr className="mb-10 border-zinc-50 break-after-page" />
    </div>
    <div className="grid grid-cols-3">
      {[cardsWithoutTokensAndBasicLands, basicLands, tokens].map((group, groupIndex) => group.map(card => n(getCount(card)).map(i => <Link className="border-3 bg-zinc-500" key={groupIndex + card.id + i} href={`/edit/${card.id}?t=/deck/${deckName}`}>
        <CardRender serializedCard={card.toJson()} scale={0.6} quality={80} />
      </Link>)))}
    </div>
  </>;
};
