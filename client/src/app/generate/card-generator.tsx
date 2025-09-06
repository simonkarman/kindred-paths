'use client';

import { Metadata } from 'next';
import { CardEditor } from '@/components/editor/card-editor';
import { getCardSamples, previewCard } from '@/utils/server';
import { useCallback, useEffect, useState } from 'react';
import { SerializedCard } from 'kindred-paths';


export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `KPA: Generate Card`,
  }
}

export function CardGenerator() {
  const [prompt, setPrompt] = useState('');
  const [generatorId, setGeneratorId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SerializedCard[]>([]);
  const [cardImages, setCardImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateCards = useCallback(async (continuation: boolean = false) => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError(null);
    if (!continuation) {
      setGeneratorId(null);
      setSuggestions([]);
      setCardImages([]);
    }

    try {
      const { generatorId: nextGeneratorId, samples } = await getCardSamples(continuation
        ? { generatorId: generatorId! }
        : { prompt });
      setGeneratorId(nextGeneratorId);
      setSuggestions(s => [...s, ...samples]);

      // Generate previews for each card
      const nextCardImages = await Promise.all(samples.map(async (suggestion) => {
        const blob = await previewCard(suggestion);
        return URL.createObjectURL(blob);
      }));
      setCardImages((i) => [...i, ...nextCardImages]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate card suggestions');
    } finally {
      setLoading(false);
    }
  }, [prompt, generatorId]);

  const handleCardClick = useCallback((card: SerializedCard) => {
    setSelectedCard(card);
  }, []);

  const handleBackToSuggestions = useCallback(() => {
    setSelectedCard(null);
  }, []);

  // Cleanup image URLs when component unmounts or suggestions change
  useEffect(() => {
    return () => {
      cardImages.forEach(url => URL.revokeObjectURL(url));
    }
  }, []);

  // If a card is selected, show the editor
  if (selectedCard) {
    return (
      <div>
        <button
          onClick={handleBackToSuggestions}
          className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
        >
          ← Back to Suggestions
        </button>
        <CardEditor start={selectedCard} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="space-y-4">
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Enter your card prompt:
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Describe the card you want to generate..."
          />
        </div>

        <button
          onClick={() => handleGenerateCards(false)}
          disabled={loading || !prompt.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating Cards...' : 'Generate Cards'}
        </button>
      </div>

      {/* Card Suggestions Grid */}
      {suggestions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Card Suggestions ({suggestions.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suggestions.map((card, index) => {
              const imageUrl = cardImages[index];
              return (
                <div
                  key={index}
                  onClick={() => handleCardClick(card)}
                  className="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow bg-white"
                >
                  <div className="aspect-[2.5/3.5] bg-gray-100 flex items-center justify-center">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Card preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-gray-500">
                        <div className="animate-pulse">Loading preview...</div>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-gray-600 truncate">
                      Click to edit this card
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results message */}
      {!loading && suggestions.length === 0 && prompt && (
        <div className="text-center py-8 text-gray-500">
          No card suggestions generated. Try a different prompt.
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Generating card suggestions...</p>
        </div>
      )}

      {/* Continuation Button */}
      {!loading && generatorId && (
        <div className="text-center">
          <button
            onClick={() => handleGenerateCards(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Generate More Cards
          </button>
        </div>
      )}
    </div>
  );
}
