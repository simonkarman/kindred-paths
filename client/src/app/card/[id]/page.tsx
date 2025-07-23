import { getCard } from '@/utils/server';
import Link from 'next/link';
import { CardRender } from '@/components/card-render';
import { CardExplanation } from '@/components/card-explanation';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default async function CardView({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.id);
  if (!serializedCard) {
    return <h1 className="text-red-500">Card not found</h1>;
  }
  return (<>
    <p className="px-2">
      <Link href={'/'} className="underline text-blue-600">Go back</Link>
    </p>
    <div className="flex items-start gap-4">
      <CardRender serializedCard={serializedCard} />
      <div className="p-2 space-y-4">
        <CardExplanation serializedCard={serializedCard} />
        <p className="border-t pt-2 border-gray-200 text-gray-500">
          Want to change something? You can <Link href={`/edit/${serializedCard.id}`} className="underline text-blue-600">
          edit <FontAwesomeIcon icon={faPenToSquare} />
        </Link>
        {' ' + serializedCard.name}.
        </p>
      </div>
    </div>
  </>);
}
