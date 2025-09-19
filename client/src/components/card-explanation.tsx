import { capitalize } from '@/utils/typography';
import { SerializedCard, Card as _Card } from 'kindred-paths';

export function CardExplanation({ serializedCard }: { serializedCard: SerializedCard }) {
  const card = new _Card(serializedCard);
  const creatableTokenNames = card.getCreatableTokenNames();
  return <div className="max-w-160 space-y-6">
    <h1 className="font-bold text-xl mb-0">{card.name}</h1>
    <p className="text-zinc-600 italic">
      {card.explain()}
    </p>
    <p>
      {card.isToken
        ? <>
          <span className="font-bold underline">Token</span><br/>
          <span className="font-bold">Color:</span> {(card.tokenColors?.length ? card.tokenColors : ['colorless']).map(capitalize).join(' and ')}<br/>
          <span className="font-bold">Reference Name:</span> {card.getTokenReferenceName()}
        </>
        : <><span className="font-bold">Mana Cost:</span> {card.renderManaCost() || 'None'}</>
      }<br />
      <span className="font-bold">Type Line:</span> {card.renderTypeLine()} <br />
      {card.pt && (
        <>
          <span className="font-bold">Power/Toughness:</span> {card.pt.power}/{card.pt.toughness} <br />
        </>
      )}
      <span className="font-bold">Rarity:</span> {capitalize(card.rarity)} <br />
    </p>
    <p>
      <span className="font-bold">Rules:</span><br />
      {card.rules.map((rule, index) => <span
        key={index}
        className={["keyword", "ability"].includes(rule.variant) ? '' : 'text-zinc-500 italic'}
      >
        {rule.variant === "keyword" ? capitalize(rule.content) : rule.content}<br/>
      </span>)}
    </p>
    {creatableTokenNames.length > 0 && <div>
      <p className="font-bold">Creatable Tokens:</p>
      <ul>
        {creatableTokenNames.map((name, i) => <li key={i} className="italic text-purple-600">{name}</li>)}
      </ul>
    </div>}
    <p>
      <span className="font-bold">Collector Number:</span> {card.collectorNumber} <br />
      <span className="font-bold">Art:</span> {card.art ?? <span className="italic text-gray-600">not set</span>}<br/>
    </p>
    {card.tags && Object.entries(card.tags).length > 0 && (<div>
      <p className="font-bold">Tags:</p>
      <ul>
        {Object.entries(card.tags).map(([key, value]) => <li key={key}>
          {capitalize(key)} | <span className="text-purple-600">{JSON.stringify(value)}</span>
        </li>)}
      </ul>
    </div>)}
  </div>;
}
