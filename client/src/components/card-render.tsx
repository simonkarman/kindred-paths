import { serverUrl } from '@/utils/server';
import { SerializedCard, Card as _Card } from 'kindred-paths';

export function CardRender({ serializedCard }: { serializedCard: SerializedCard }) {
  const card = new _Card(serializedCard);
  return <>
      <img
        alt={card.name + " image"}
        className="aspect-[63/88] w-100 bg-gray-50 rounded-3xl border"
        src={`${serverUrl}/card/${card.id}/render`}
      />
  </>;
}
