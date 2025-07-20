import { getCard, serverUrl } from '@/utils/server';
import { Card } from 'kindred-paths';
import Link from 'next/link';

export default async function CardEdit({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.id);
  if (!serializedCard) {
    return <h1 className="text-red-500">Card not found</h1>;
  }
  const card = new Card(serializedCard);
  return (<>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <div className="flex">
      <img
        alt={card.name + " image"}
        className="aspect-[63/88] w-100 bg-gray-50 rounded-3xl border"
        src={`${serverUrl}/card/${params.id}/render`}
      />
      <div className="grow-0 max-w-160 p-4 space-y-6 border rounded-3xl border-gray-200">
        <h1 className="font-bold text-xl mb-0">{card.name}</h1>
        <p className="text-gray-600 italic">
          {card.explain()}
        </p>
        <p>
          <span className="font-bold">ID:</span> {card.id} <br />
          <span className="font-bold">Rarity:</span> {card.rarity} <br />
          <span className="font-bold">Type Line:</span> {card.renderTypeLine()} <br />
          <span className="font-bold">Mana Cost:</span> {card.renderManaCost() || 'None'} <br />
          <span className="font-bold">Collector Number:</span> {card.collectorNumber} <br />
          {card.pt && (
            <>
              <span className="font-bold">Power/Toughness:</span> {card.pt.power}/{card.pt.toughness} <br />
            </>
          )}
        </p>
        <p>
          <span className="font-bold">Rules:</span><br />
          {card.rules.map((rule, index) => <span key={index}>{rule.content}<br/></span>)}
        </p>
        <p>
          {card.art && (
            <>
              <span className="font-bold">Art:</span> {card.art} <br />
            </>
          )}
          {card.tags && Object.entries(card.tags).length > 0 && (<>
            <span className="font-bold">Tags:</span>
            <ul>
              {Object.entries(card.tags).map(([key, value]) => <li key={key}>{key}: {value}</li>)}
            </ul>
          </>)}
        </p>
      </div>
    </div>
  </>);
}
