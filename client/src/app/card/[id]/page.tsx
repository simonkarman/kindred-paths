import { Metadata } from 'next';
import Link from 'next/link';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CardRender } from '@/components/card-render';
import { CardExplanation } from '@/components/card-explanation';
import { getCard } from '@/utils/server';
import { PageProps } from '@/utils/page-props';

export async function generateMetadata({ params }: PageProps<{ id: string }>): Promise<Metadata> {
  const card = await getCard(params.id);
  return {
    title: `KPA: #${card?.collectorNumber} - ${card?.name ?? params.id}`,
  }
}

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
        <p className="border-t pt-2 border-zinc-200 text-zinc-500">
          Want to change something? You can <Link href={`/edit/${serializedCard.id}`} className="underline text-blue-600">
          edit <FontAwesomeIcon icon={faPenToSquare} />
        </Link>
        {' ' + serializedCard.name}.
        </p>
      </div>
    </div>
  </>);
}
