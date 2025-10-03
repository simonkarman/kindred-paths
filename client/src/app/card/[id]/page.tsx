import { Metadata } from 'next';
import Link from 'next/link';
import { faPenToSquare, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { CardRender } from '@/components/card-render';
import { CardExplanation } from '@/components/card-explanation';
import { getCard } from '@/utils/server';
import { PageProps } from '@/utils/page-props';

export async function generateMetadata({ params: _params }: PageProps<{ id: string }>): Promise<Metadata> {
  const params = await _params;
  const card = await getCard(params.id);
  return {
    title: `KPA: #${card?.collectorNumber} - ${card?.name ?? params.id}`,
  }
}

export default async function CardView({ params: _params }: Readonly<{ params: Promise<{ id: string }> }>) {
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
              The card with ID "{params.id}" could not be found.
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
        <div className="flex lg:flex-row justify-center items-center lg:items-start flex-col gap-8">
          {/* Card Render Section */}
          <div className="shrink-0 space-y-6">
            {/* Card Render */}
            <div className="bg-white rounded-2xl shadow-lg w-112">
              <CardRender serializedCard={serializedCard} />
            </div>


            {/* Edit Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-md">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <FontAwesomeIcon icon={faPenToSquare} className="text-blue-600 text-xl" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2">
                    Want to make changes?
                  </h3>
                  <p className="text-sm text-blue-800 mb-3">
                    You can edit {serializedCard.name} to modify its properties, <br/>abilities, or artwork.
                  </p>
                  <Link
                    href={`/edit/${serializedCard.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                    Edit Card
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Card Information Section */}
          <div className="space-y-6">
            {/* Card Details Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Card Details
              </h2>
              <CardExplanation serializedCard={serializedCard} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
