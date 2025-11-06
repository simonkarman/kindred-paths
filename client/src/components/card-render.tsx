import { serverUrl } from '@/utils/server';
import { Card, SerializedCard } from 'kindred-paths';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPenToSquare } from '@fortawesome/free-solid-svg-icons';

export function CardRender({ serializedCard, faceIndex, shown = true, forceRender, hoverControls = false, quality, scale, hideBorder }: {
  serializedCard: SerializedCard,
  faceIndex: number,
  shown?: boolean,
  forceRender?: boolean,
  hoverControls?: boolean,
  quality?: number,
  scale?: number,
  hideBorder?: boolean,
}) {
  const card = new Card(serializedCard);
  const cardFace = card.faces[faceIndex];

  const hoverStyle = "flex w-full rounded-2xl text-3xl hover:text-6xl items-center justify-center absolute inset-0 cursor-pointer z-5 transition-all duration-150 group-hover:bg-black/20 hover:bg-black/40 text-white/0 group-hover:text-white";
  const hoverAreaSizes: [string, string] = card.isToken
    ? (
      cardFace.rules.length === 0
        ? ['bottom-[20%]', 'top-[80%]']
        : ['bottom-[37%]', 'top-[63%]']
      )
    : ['bottom-[44%]', 'top-[56%]'];

  return (
    <div className="relative group">
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={cardFace.name + " image"}
        className={`${shown ? 'scale-x-100' : 'scale-x-0'} transition-all aspect-[63/88] w-120 print:w-100 not-print:rounded-2xl border ${hideBorder ? 'bg-transparent border-transparent' : 'bg-zinc-400'}`}
        src={`${serverUrl}/render/${card.id}/${faceIndex}?force=${forceRender ? 'true' : 'false'}&scale=${scale || 1}&quality=${quality || 100}`}
      />
      {hoverControls && <>
        {/* Clickable areas */}
        {/* Top half - View card */}
        <Link
          href={`/card/${card.id}`}
          className={`${hoverAreaSizes[0]} ${hoverStyle}`}
          title={`View ${cardFace.name}`}
        >
          <FontAwesomeIcon icon={faEye} />
        </Link>

        {/* Bottom half - Edit card */}
        <Link
          href={`/edit/${card.id}?t=/`}
          className={`${hoverAreaSizes[1]} ${hoverStyle}`}
          title={`Edit ${cardFace.name}`}
        >
          <FontAwesomeIcon icon={faPenToSquare} />
        </Link>
      </>}
    </div>
  );
}
