"use client";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsTurnRight, faClone, faForward, faPenToSquare, faSpinner } from '@fortawesome/free-solid-svg-icons';
import Link from 'next/link';
import { useState } from 'react';
import { CardRender } from '@/components/card-render';
import { CardExplanation } from '@/components/card-explanation';
import { SerializedCard } from 'kindred-paths';

export const CardView = (props: { serializedCard: SerializedCard }) => {
  const { serializedCard } = props;
  const [forceRender, setForceRender] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);
  const dualFaced = serializedCard.layout === 'modal_dfc';

  return <div className="flex lg:flex-row justify-center items-center lg:items-start flex-col gap-8">
    {/* Card Render Section */}
    <div className="shrink-0 flex flex-col items-center space-y-6">
      {/* Card Render */}
      <div className="bg-white rounded-2xl shadow-lg">
        <div className="absolute">
          {dualFaced && <CardRender serializedCard={serializedCard} forceRender={forceRender} faceIndex={1} shown={faceIndex === 1} />}
        </div>
        <CardRender serializedCard={serializedCard} forceRender={forceRender} faceIndex={0} shown={faceIndex === 0} />
      </div>

      <div className="flex gap-3 justify-center">
        {/* Edit Card Button */}
        <Link
          href={`/edit/${serializedCard.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <FontAwesomeIcon icon={faPenToSquare} />
          Edit
        </Link>

        {/* Clone Card Button */}
        <Link
          href={`/clone/${serializedCard.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <FontAwesomeIcon icon={faClone} />
          Clone
        </Link>

        {/* Flip Card Button */}
        {dualFaced && <div>
          <button
            onClick={() => setFaceIndex(i => (i + 1) % serializedCard.faces.length)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            <FontAwesomeIcon icon={faArrowsTurnRight} />
            Flip card
          </button>
        </div>}

        {/* Force Rerender Button */}
        {forceRender
          ? (<div
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors shadow-sm"
            >
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Rerendering...
            </div>)
          : (<button
              onClick={() => {
                setForceRender(true);
                setTimeout(() => setForceRender(false), 11000);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
            >
              <FontAwesomeIcon icon={faForward} />
              Force Rerender
            </button>)
        }
      </div>
    </div>

    {/* Card Information Section */}
    <div className="space-y-6">
      {/* Card Details Card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          {serializedCard.faces.map(f => f.name).join(' // ')}
        </h2>
        <CardExplanation serializedCard={serializedCard} />
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
              You can edit {serializedCard.faces.map(f => f.name).join(' // ')} to modify its properties, <br className="hidden lg:inline" />abilities, or artwork.
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
  </div>
}
