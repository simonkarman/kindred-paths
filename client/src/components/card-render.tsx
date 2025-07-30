import { serverUrl } from '@/utils/server';
import { SerializedCard, Card as _Card } from 'kindred-paths';

export function CardRender({ serializedCard, quality, scale }: {
  serializedCard: SerializedCard,
  quality?: number,
  scale?: number,
}) {
  const card = new _Card(serializedCard);
  return <>
      <img
        alt={card.name + " image"}
        className="aspect-[63/88] w-100 bg-zinc-100 rounded-2xl border"
        src={`${serverUrl}/render/${card.id}?scale=${scale || 1}&quality=${quality || 100}`}
      />
  </>;
}
