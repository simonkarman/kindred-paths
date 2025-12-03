import { Metadata } from 'next';
import Link from 'next/link';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { getCard } from '@/utils/api';
import { PageProps } from '@/utils/page-props';
import { CardView } from '@/app/card/[id]/card-view';

export async function generateMetadata({ params: _params }: PageProps<{ id: string }>): Promise<Metadata> {
  const params = await _params;
  const card = await getCard(params.id);
  return {
    title: `${card?.faces.map(f => f.name).join(' // ') ?? params.id} - Kindred Paths`,
  }
}

export default async function Page({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await _params;
  const serializedCard = await getCard(params.id);

  if (!serializedCard) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-600 text-4xl mb-4" />
            <h1 className="text-2xl font-bold text-red-900 mb-2">Card Not Found</h1>
            <p className="text-red-700 mb-4">
              The card with ID &ldquo;{params.id}&rdquo; could not be found.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <CardView serializedCard={serializedCard} />
      </div>
    </div>
  );
}
