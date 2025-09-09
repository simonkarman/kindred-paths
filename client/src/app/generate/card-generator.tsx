'use client';

import { Metadata } from 'next';
import { CardEditor } from '@/components/editor/card-editor';
import { getCardSampleGeneratorById, getCardSamples, previewCard } from '@/utils/server';
import { useCallback, useEffect, useState } from 'react';
import { SerializedCard } from 'kindred-paths';
import { CardsStatistics } from '@/components/cards-statistics';
import { CardTable } from '@/components/overview/card-table';
import SearchBar from '@/components/search-bar';
import { filterCardsBasedOnSearch, useSearch } from '@/utils/use-search';


export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `KPA: Generate Card`,
  }
}

export function CardGenerator(props: { previousCardGenerators: { generatorId: string, createdAt: string, updatedAt: string, prompt: string, sampleCount: number }[] }) {
  const [showPreviousGenerators, setShowPreviousGenerators] = useState(false);
  const [previousCardGenerators, setPreviousCardGenerators] = useState(props.previousCardGenerators);
  const [prompt, setPrompt] = useState('');
  const [generatorId, setGeneratorId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SerializedCard[]>([]);
  const [cardImages, setCardImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText] = useSearch();

  const viewGenerator = async (generatorId: string) => {
    const generator = await getCardSampleGeneratorById(generatorId);
    if (!generator) {
      return;
    }
    setShowPreviousGenerators(false);
    setLoading(true);
    setError(null);
    setGeneratorId(generator.generatorId);
    setSuggestions(generator.samples);
    setCardImages([]);
    setPrompt(previousCardGenerators.find(g => g.generatorId === generatorId)?.prompt || 'unknown prompt');

    // Generate previews for each card
    const nextCardImages = await Promise.all(generator.samples.map(async (suggestion) => {
      const blob = await previewCard(suggestion);
      return URL.createObjectURL(blob);
    }));
    setCardImages(nextCardImages);
    setLoading(false);
  }

  const handleGenerateCards = useCallback(async (continuation: boolean) => {
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
      setPreviousCardGenerators(pcgs => {
        const now = new Date().toISOString();
        let found = false;
        let nextPcgs = pcgs.map(pcg => {
          if (pcg.generatorId === nextGeneratorId) {
            found = true;
            return {
              ...pcg,
              updatedAt: now,
              sampleCount: pcg.sampleCount + samples.length
            };
          }
          return pcg;
        });
        if (!found) {
          nextPcgs = [{
            generatorId: nextGeneratorId,
            createdAt: now,
            updatedAt: now,
            prompt,
            sampleCount: samples.length
          }, ...nextPcgs];
        }
        return nextPcgs;
      });

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

      {/* Previous Generations Section */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-xl font-semibold mb-4">Previous Generations</h2>

        {showPreviousGenerators && (
          <div className="space-y-4">
            <div className="space-y-2">
              {previousCardGenerators.map(generator => (
                <div
                  key={generator.generatorId}
                  className={`p-3 rounded-lg border transition-colors ${
                    generator.generatorId === generatorId
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {generator.generatorId === generatorId && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Current
                          </span>
                        )}
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {generator.sampleCount} cards
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {generator.createdAt.substring(0, 16).replace('T', ' at ')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {generator.prompt}
                      </p>
                    </div>
                    <button
                      disabled={loading}
                      onClick={() => viewGenerator(generator.generatorId)}
                      className="ml-3 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPreviousGenerators(false)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Hide Previous Generations
            </button>
          </div>
        )}

        {!showPreviousGenerators && previousCardGenerators.length > 0 && (
          <button
            onClick={() => setShowPreviousGenerators(true)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Show Previous Generations ({previousCardGenerators.length})
          </button>
        )}
      </div>

      {/* Input Section */}
      <h2 className="text-3xl font-bold text-center mb-8">Generate Cards</h2>
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

      <div className="border rounded-xl border-zinc-300 shadow-lg p-4 bg-zinc-50 space-y-4">
        {/* Card Suggestions Grid */}
        {suggestions.length > 0 && (<>
          <div className="flex gap-4 items-start">
            <h2 className="shrink-0 text-xl font-semibold">
              Card Suggestions ({suggestions.length})
            </h2>
            <SearchBar />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filterCardsBasedOnSearch(
              suggestions.map((s, i) => ({ ...s, tags: { ...s.tags, imageIndex: i } })),
              searchText
            ).map((card) => {
              const imageIndex = card.tags?.imageIndex as unknown as number;
              const imageUrl = cardImages[imageIndex];
              return (
                <div
                  key={card.id}
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
                </div>
              );
            })}
          </div>
        </>)}

        {/* No results message */}
        {!loading && suggestions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No card suggestions generated. Please enter a prompt or select a previous generation.
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

      {suggestions.length > 0 && <>
        <h2 className="text-xl font-semibold">An Overview and Statistics</h2>
        <CardTable
          skipDeckFilter={true}
          onSelect={handleCardClick}
          cards={suggestions}
        />
        <CardsStatistics
          cards={suggestions}
        />
      </>}
    </div>
  );
}
