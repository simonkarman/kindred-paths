import { Card, SerializedCard } from 'kindred-paths';
import Link from 'next/link';
import { CardRender } from '@/components/card-render';

const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

export function CardRenderOverview(props: {
  cardGroups: SerializedCard[][],
  dynamicLink?: (card: SerializedCard) => string,
}) {
  return <div className="grid grid-cols-3">
    {props.cardGroups.map((group, groupIndex) => group
      .map(card => n(new Card(card).getTagAsNumber("count") ?? 0)
        .map(i => <Link
            key={groupIndex + card.id + i}
            className="border-3 bg-zinc-500"
            href={props.dynamicLink ? props.dynamicLink(card) : `/card/${card.id}`}
          >
            <CardRender serializedCard={card} scale={0.6} quality={80} />
          </Link>
        )
      ))}
  </div>
}
