import { getCard } from '@/utils/api';
import Link from 'next/link';
import { CardEditor } from '@/components/editor/card-editor';
import { PageProps } from '@/utils/page-props';
import type { Metadata } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export async function generateMetadata({ params: _params }: PageProps<{ id: string }>): Promise<Metadata> {
  const params = await _params;
  const card = await getCard(params.id);
  return {
    title: `Edit ${card?.faces.map(f => f.name).join(' // ') ?? params.id} - Kindred Paths`,
  }
}

export default async function CardEdit({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.id);
  if (!serializedCard) {
    return <h1 className="text-red-500">Card not found</h1>;
  }
  return (<>
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full flex justify-center">
        <Link
          href={`/card/${serializedCard.id}`}
          className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          View {serializedCard.faces.map(f => f.name).join(' // ')}
        </Link>
      </div>
      <CardEditor initialCard={serializedCard} />
    </div>
  </>);
}
