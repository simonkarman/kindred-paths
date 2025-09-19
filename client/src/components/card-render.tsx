import { serverUrl } from '@/utils/server';
import { SerializedCard, Card as _Card } from 'kindred-paths';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPenToSquare } from '@fortawesome/free-solid-svg-icons';

export function CardRender({ serializedCard, hoverControls = false, quality, scale }: {
  serializedCard: SerializedCard,
  hoverControls?: boolean,
  quality?: number,
  scale?: number,
}) {
  const card = new _Card(serializedCard);

  const hoverStyle = "flex text-3xl hover:text-6xl items-center justify-center absolute inset-0 cursor-pointer z-5 transition-all duration-150 group-hover:bg-black/20 hover:bg-black/40 text-white/0 group-hover:text-white";
  const hoverAreaSizes: [string, string] = card.id
    ? (
      card.rules.length === 0
        ? ['bottom-[20%]', 'top-[80%]']
        : ['bottom-[37%]', 'top-[63%]']
      )
    : ['bottom-[44%]', 'top-[56%]'];

  return (
    <div className="relative group">
      {/* Image */}
      <img
        alt={card.name + " image"}
        className="aspect-[63/88] w-100 bg-zinc-100 rounded-2xl border"
        src={`${serverUrl}/render/${card.id}?scale=${scale || 1}&quality=${quality || 100}`}
      />

      {hoverControls && <>
        {/* Clickable areas */}
        {/* Top half - View card */}
        <Link
          href={`/card/${card.id}`}
          className={`${hoverAreaSizes[0]} ${hoverStyle}`}
          title={`View ${card.name}`}
        >
          <FontAwesomeIcon icon={faEye} />
        </Link>

        {/* Bottom half - Edit card */}
        <Link
          href={`/edit/${card.id}?t=/`}
          className={`${hoverAreaSizes[1]} ${hoverStyle}`}
          title={`Edit ${card.name}`}
        >
          <FontAwesomeIcon icon={faPenToSquare} />
        </Link>
      </>}
    </div>
  );
}
