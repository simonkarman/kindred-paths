import { capitalize, enumerate, Card, SerializedCard } from 'kindred-paths';
import { ManaCost } from '@/components/mana-cost';

export function CardExplanation({ serializedCard, activeFaceIndex }: { serializedCard: SerializedCard, activeFaceIndex: number }) {
  const card = new Card(serializedCard);
  const face0 = card.faces[0];
  const face1 = card.faces.length > 1 ? card.faces[1] : undefined;
  const creatableTokenNames = card.faces.flatMap(f => f.getCreatableTokenNames());

  const rarityColors = {
    common: 'bg-slate-100 text-slate-700',
    uncommon: 'bg-blue-100 text-blue-700',
    rare: 'bg-amber-100 text-amber-700',
    mythic: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      {card.faces.map((face, faceIndex) => <div
        key={faceIndex}
        className={`space-y-6 my-8 transition-opacity ${card.layout.isDualRenderLayout() && faceIndex !== activeFaceIndex ? 'opacity-60' : ''}`}
      >
        {card.faces.length > 1 && <h3 className="text-lg font-semibold text-slate-900 mb-2">
          {card.layout.isDualRenderLayout() && faceIndex === activeFaceIndex && '➤ '}
          {face.name}
        </h3>}

        {/* Summary */}
        <div className="pb-4 border-b border-slate-200">
          <p className="text-zinc-400 pl-2 italic text-sm leading-relaxed">
            {face.explain()}
          </p>
        </div>

        {/* Card Face Properties */}
        <div className="space-y-3">
          {card.isToken ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Status</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  Token
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Color</span>
                <span className="text-sm text-slate-900">
                  {(face.givenColors?.length ? face.givenColors : ['colorless']).map(capitalize).join(' and ')}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Reference Name</span>
                <span className="text-sm font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  {face.getTokenReferenceName()}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Mana Cost</span>
              <span className="text-sm text-slate-900">
                {<ManaCost cost={face.renderManaCost()} />}
              </span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Type Line</span>
            <span className="text-sm text-slate-900">{face.renderTypeLine()}</span>
          </div>

          {face.pt && (
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Power/Toughness</span>
              <span className="text-sm font-semibold text-slate-900">
                {face.pt.power}/{face.pt.toughness}
              </span>
            </div>
          )}

          {face.producibleColors().length > 0 && (
            <div className="flex items-start gap-3">
              <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Producible Colors</span>
              <span className="text-sm text-slate-900">{enumerate(face.producibleColors().map(c => capitalize(c)))}</span>
            </div>
          )}
        </div>

        {/* Rules Text */}
        {face.rules.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            {face.rules.map((rule, index) => (
              <div
                key={index}
                className={`text-sm leading-relaxed ${
                  ["keyword", "ability"].includes(rule.variant)
                    ? 'text-slate-900'
                    : 'text-slate-600 italic'
                }`}
              >
                {rule.variant === "keyword" ? capitalize(rule.content) : rule.content}
              </div>
            ))}
          </div>
        )}
      </div>)}

      {/* Creatable Tokens */}
      {creatableTokenNames.length > 0 && (
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Creatable Tokens</h3>
          <div className="flex flex-wrap gap-2">
            {creatableTokenNames.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="pt-6 border-t border-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Layout</span>
          <span className="text-sm text-slate-900">{capitalize(card.layout.id)}</span>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Rarity</span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${rarityColors[card.rarity]}`}>
            {capitalize(card.rarity)}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Collector Number</span>
          <span className="text-sm text-slate-900">#{card.collectorNumber}</span>
        </div>

        <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Artwork{card.layout.isDualRenderLayout() ? ' (front)' : ''}</span>
          {face0.art ? (
            <span className="text-sm text-slate-900 break-all">{face0.art}</span>
          ) : (
            <span className="text-sm italic text-slate-400">Not set</span>
          )}
        </div>
        {face1 && card.layout.isDualRenderLayout() && <div className="flex items-start gap-3">
          <span className="text-sm font-medium text-slate-500 w-32 flex-shrink-0">Artwork (back)</span>
          {face1.art ? (
            <span className="text-sm text-slate-900 break-all">{face1.art}</span>
          ) : (
            <span className="text-sm italic text-slate-400">Not set</span>
          )}
        </div>}
      </div>

      {/* Tags */}
      {card.tags && Object.entries(card.tags).length > 0 && (
        <div className="pt-6 border-t border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Tags</h3>
          <div className="space-y-2">
            {Object.entries(card.tags).map(([key, value]) => (
              <div key={key} className="flex items-start gap-3 text-sm">
                <span className="font-medium text-slate-700 w-32 flex-shrink-0">
                  {capitalize(key)}
                </span>
                <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded break-all">
                  {JSON.stringify(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
