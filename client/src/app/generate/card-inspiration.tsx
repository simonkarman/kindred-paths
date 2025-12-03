'use client';

import { CardEditor } from '@/components/editor/card-editor';
import { getCardSampleGeneratorById, getCardSamples, previewCard } from '@/utils/api';
import { useCallback, useEffect, useState } from 'react';
import { SerializedCard, filterCardsBasedOnSearch } from 'kindred-paths';
import SearchBar from '@/components/search-bar';
import { useSearch } from '@/utils/use-search';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAngleDown, faAngleUp, faArrowLeft, faPlus, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';

export function CardInspiration(props: { previousCardGenerators: { generatorId: string, createdAt: string, updatedAt: string, prompt: string, sampleCount: number }[] }) {
  const [showPreviousGenerators, setShowPreviousGenerators] = useState(false);
  const [previousCardGenerators, setPreviousCardGenerators] = useState(props.previousCardGenerators);
  const [prompt, setPrompt] = useState('');
  const [generatorId, setGeneratorId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SerializedCard[]>([]);
  const [cardImages, setCardImages] = useState<string[]>([]);
  const [selectedCard, setSelectedCard] = useState<SerializedCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchScope = `card-generator/${generatorId}`;
  const [searchText] = useSearch(searchScope);

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

    const nextCardImages = await Promise.all(generator.samples.map(async (suggestion) => {
      const blob = await previewCard(suggestion, 0);
      return URL.createObjectURL(blob);
    }));
    setCardImages(nextCardImages);
    setLoading(false);
  }

  const handleGenerateCards = useCallback(async (continuation: boolean) => {
    if (!continuation && !prompt.trim()) {
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

      const nextCardImages = await Promise.all(samples.map(async (suggestion) => {
        const blob = await previewCard(suggestion, 0);
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

  useEffect(() => {
    return () => {
      cardImages.forEach(url => URL.revokeObjectURL(url));
    }
  }, [cardImages]);

  if (selectedCard) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full flex justify-center">
          <button
            onClick={handleBackToSuggestions}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to Suggestions
          </button>
        </div>
        <CardEditor initialCard={selectedCard} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-3">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-purple-600" />
            Card Inspiration
          </h1>
          <p className="text-slate-600">Generate unique Magic the Gathering cards with AI</p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Create Your Card</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 mb-2">
                Describe your card idea
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                rows={4}
                placeholder="E.g., 'A legendary dragon creature that creates treasure tokens when it attacks' or 'An instant that counters a spell and draws a card'"
              />
            </div>

            <button
              onClick={() => handleGenerateCards(false)}
              disabled={loading || !prompt.trim()}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating Cards...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                  Generate Cards
                </>
              )}
            </button>
          </div>
        </div>

        {/* Card Suggestions Section */}
        {(suggestions.length > 0 || loading || error) && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Card Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
              </h2>
              {suggestions.length > 0 && (
                <div className="w-full sm:w-auto sm:max-w-md flex">
                  <SearchBar scope={searchScope} />
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Cards Grid */}
            {suggestions.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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
                        className="group border border-slate-200 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all bg-white"
                      >
                        <div className="aspect-[2.5/3.5] bg-slate-100 flex items-center justify-center relative">
                          {imageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imageUrl}
                                alt="Card preview"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-all flex items-center justify-center">
                                <span className="opacity-0 group-hover:opacity-100 text-white font-semibold bg-blue-600 px-4 py-2 rounded-lg transition-all">
                                  Edit Card
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-500 text-center p-4">
                              <div className="animate-pulse">Loading preview...</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mb-4"></div>
                    <p className="text-slate-600 font-medium">Generating card suggestions...</p>
                    <p className="text-slate-500 text-sm mt-1">This may take a moment</p>
                  </div>
                )}

                {/* Generate More Button */}
                {generatorId && (
                  <div className="text-center">
                    <button
                      onClick={() => handleGenerateCards(true)}
                      disabled={loading}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      Generate More Cards
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Empty State */}
            {!loading && suggestions.length === 0 && !error && (
              <div className="text-center py-12 text-slate-500">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-4xl mb-4 text-slate-300" />
                <p>No card suggestions yet</p>
                <p className="text-sm mt-1">Enter a prompt above to get started</p>
              </div>
            )}
          </div>
        )}

        {/* Previous Generations Section */}
        {previousCardGenerators.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Previous Generations</h2>
              <button
                onClick={() => setShowPreviousGenerators(!showPreviousGenerators)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                <FontAwesomeIcon icon={showPreviousGenerators ? faAngleUp : faAngleDown} />
                {showPreviousGenerators ? 'Hide' : `Show (${previousCardGenerators.length})`}
              </button>
            </div>

            {showPreviousGenerators && (
              <div className="space-y-3">
                {previousCardGenerators.map(generator => (
                  <div
                    key={generator.generatorId}
                    className={`p-4 rounded-lg border transition-all ${
                      generator.generatorId === generatorId
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {generator.generatorId === generatorId && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                              Active
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                            {generator.sampleCount} cards
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(generator.createdAt).toLocaleDateString()} at {new Date(generator.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2">
                          {generator.prompt}
                        </p>
                      </div>
                      <button
                        disabled={loading}
                        onClick={() => viewGenerator(generator.generatorId)}
                        className="flex-shrink-0 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
