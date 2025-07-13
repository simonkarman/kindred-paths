"use client";
import { useEffect, useState } from 'react';

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4101';

const CardImage = ({ selectedCard }: { selectedCard: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [selectedCard]);

  return (
    <div className="relative aspect-[63/88] w-100">
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 border bg-gradient-to-br from-gray-100 via-green-500 to-purple-400 border-gray-400 shadow rounded-xl flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            {/* Spinner */}
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="text-white text-sm font-medium">Rendering card...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 border border-gray-400 shadow rounded-xl flex items-center justify-center bg-gray-100">
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm">Failed to render</p>
          </div>
        </div>
      )}

      {/* Actual image */}
      <img
        className={`border bg-gradient-to-br from-gray-100 via-green-500 to-purple-400 border-gray-400 shadow rounded-xl aspect-[63/88] w-100 transition-opacity duration-1000 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        src={`${serverUrl}/card/${selectedCard}/render`}
        onLoad={handleLoad}
        onError={handleError}
        alt={selectedCard}
      />
    </div>
  );
};

export default function Home() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedCardJson, setSelectedCardJson] = useState<string | null>(null);
  const cardNames: string[] = ["emry"];

  useEffect(() => {
    const fetchCardJson = async (cardName: string) => {
      try {
        const response = await fetch(`${serverUrl}/card/${cardName}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch card ${cardName}`);
        }
        const data = await response.json();
        setSelectedCardJson(JSON.stringify(data, null, 2));
      } catch (error) {
        console.error(error);
        setSelectedCardJson(null);
      }
    };

    if (selectedCard) {
      fetchCardJson(selectedCard);
    } else {
      setSelectedCardJson(null);
    }
  }, [selectedCard]);

  return (
    <div className="p-2">
      <h1 className="font-bold">Kindred Paths</h1>
      <p>
        A tool for managing the cards in Kindred Paths, the custom Magic the Gathering set
        by <a
          className="text-blue-800 underline"
          href="https://simonkarman.nl"
          target="_blank"
        >
          Simon Karman
        </a>.
      </p>
      <div className="flex flex-grow gap-2">
        <div className="p-2 grow-0 flex flex-col gap-2">
          {selectedCard === null ? (
            <div
              className="bg-gray-100 border border-gray-400 shadow rounded-xl aspect-[63/88] w-100"
            />
          ) : (<>
            <CardImage selectedCard={selectedCard} />
            <pre className="text-sm w-100 h-80 overflow-scroll p-2 bg-gray-200 rounded-xl border">
                {selectedCardJson}
            </pre>
          </>)}
        </div>
        <div className="grow flex flex-col p-2 gap-2">
          {cardNames.map(cardName => {
            const isSelected = selectedCard === cardName;
            return <div
              key={cardName}
              className="flex items-center gap-2"
            >
              <button
                onClick={() => {
                  if (isSelected) {
                    setSelectedCard(null);
                  } else {
                    setSelectedCard(cardName);
                  }
                }}
                className="bg-gray-100 text-gray-600 border border-gray-400 shadow rounded-xl px-1 font-mono"
              >
                {isSelected ? '[X]' : '[ ]'}
              </button>
              <h2 className="font-bold">
                {cardName[0].toUpperCase() + cardName.slice(1)}
              </h2>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
