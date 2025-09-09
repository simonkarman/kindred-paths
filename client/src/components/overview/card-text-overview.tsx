import { Card, SerializedCard } from 'kindred-paths';
import Link from 'next/link';

export function CardTextOverview(props: { cards: SerializedCard[] }) {
  return <ul className="grid grid-cols-2 py-2 gap-y-1 gap-x-4">
    {props.cards.map(c => {
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
    {props.cards.length === 0 && (
      <li className="text-zinc-500">No cards in this deck.</li>
    )}
  </ul>
}
