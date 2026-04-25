import { getCard } from '@/utils/api';
import Link from 'next/link';
import { CardEditor } from '@/components/editor/card-editor';
import { PageProps } from '@/utils/page-props';
import type { Metadata } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { Card, generateCardId } from 'kindred-paths';
import { cardPath } from '@/utils/slugify';

export async function generateMetadata({ params: _params }: PageProps<{ cid: string; name: string }>): Promise<Metadata> {
  const params = await _params;
  const card = await getCard(params.cid);
  return {
    title: `Clone of ${card?.faces.map(f => f.name).join(' // ') ?? params.cid} - Kindred Paths`,
  }
}

export default async function CardClone({ params: _params }: Readonly<{ params: Promise<{ cid: string; name: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.cid);
  if (!serializedCard) {
    return <h1 className="text-red-500">Card not found</h1>;
  }

  const start = new Card({
    ...serializedCard,
    cid: generateCardId(),
    collectorNumber: serializedCard.collectorNumber + 1,
  }).toJson();

  return (<>
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex justify-center">
        <Link
          href={cardPath(serializedCard.cid, serializedCard.faces[0].name)}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          View Original {serializedCard.faces.map(f => f.name).join(' // ')}
        </Link>
      </div>
      <CardEditor isNewCard={true} initialCard={start} />
    </div>
  </>);
}
