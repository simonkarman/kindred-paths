import { capitalize, Card, SerializedCard } from 'kindred-paths';
import Link from 'next/link';
import { useDeckNameFromSearch } from '@/utils/use-search';

export function TextTab(props: { cards: SerializedCard[] }) {
  const deckName = useDeckNameFromSearch();

  if (props.cards.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-12 text-center">
        <p className="text-slate-500">No cards found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {props.cards.map(c => {
          const card = new Card(c);
          const deckCount = card.getTagAsNumber(`deck/${deckName}`);
          const setInfo = card.tags?.set ? `${card.tags.set}#${card.collectorNumber}` : `#${card.collectorNumber}`;

          return (
            <li
              key={card.id}
              className="group border-b border-slate-100 space-y-2 pb-4 last:border-b-0 hover:bg-slate-50 -mx-2 px-2 py-2 rounded transition-colors"
            >
              <div className="flex items-baseline gap-2">
                {deckName && deckCount && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex-shrink-0">
                    {deckCount}x
                  </span>
                )}
                <Link
                  href={`/card/${card.id}`}
                  className="text-blue-600 hover:text-blue-700 font-semibold hover:underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
                >
                  {card.faces.map(f => f.name).join(' // ')}
                </Link>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {setInfo}
                </span>
              </div>
              {card.layout.id !== 'normal' && (
                <div className="text-xs text-slate-400">
                  {capitalize(card.layout.id)} Layout
                </div>
              )}
              {card.faces.map(face =>
                <p key={face.name} className="text-sm text-slate-600 leading-relaxed">
                  {face.explain({ withoutName: true })}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
