import { Card, hash } from 'kindred-paths';
import { useCallback, useEffect, useRef, useState } from 'react';

import { previewCard } from '@/utils/preview-card';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getRenderKey = (card: Card) => {
  return hash(JSON.stringify({
    ...card.toJson(),
    id: undefined,
    tags: Object.entries(card.tags).filter(([k]) =>
      k.startsWith('fs/') // Include all font size tags
      || k.startsWith('art/') // Include all art tags
      || k === 'set' // Include set tag
    ),
  }))
}

export function CardPreview({ card }: { card: Card }) {
  const latestRenderIndex = useRef(0);

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [latestRenderKey, setLatestRenderKey] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const [image, setImage] = useState<string>();
  const [image2, setImage2] = useState<string>();
  const [error, setError] = useState<string>();

  const cleanupImageOne = useCallback(() => {
    if (image) { URL.revokeObjectURL(image); }
  }, [image]);
  const cleanupImageTwo = useCallback(() => {
    if (image2) { URL.revokeObjectURL(image2); }
  }, [image2]);
  useEffect(() => cleanupImageOne, [cleanupImageOne]);
  useEffect(() => cleanupImageTwo, [cleanupImageTwo]);

  const handleRefresh = useCallback(async (initialWait = 0) => {
    const thisRenderIndex: number = latestRenderIndex.current + 1;
    latestRenderIndex.current = thisRenderIndex;

    setLatestRenderKey(getRenderKey(card));
    setError(undefined);
    setIsRendering(true);
    try {
      await sleep(initialWait);
      if (thisRenderIndex === latestRenderIndex.current) {
        // Render the primary face
        const cardJson = card.toJson();
        const [blobOne, blobTwo] = await Promise.all(card.layout.isDualRenderLayout()
          ? [previewCard(cardJson, 0), previewCard(cardJson, 1)]
          : [previewCard(cardJson, 0)]
        );
        if (thisRenderIndex === latestRenderIndex.current) {
          cleanupImageOne();
          setImage(URL.createObjectURL(blobOne));

          cleanupImageTwo();
          if (blobTwo) {
            setImage2(URL.createObjectURL(blobTwo));
          } else {
            setImage2(undefined);
          }
        }
      }
    } catch (error) {
      if (thisRenderIndex === latestRenderIndex.current) {
        setError(error instanceof Error ? error.message : 'Failed to render preview');
      }
    } finally {
      if (thisRenderIndex === latestRenderIndex.current) {
        setIsRendering(false);
      }
    }
  }, [card, cleanupImageOne, cleanupImageTwo]);

  const isOutdated = latestRenderKey !== getRenderKey(card);
  useEffect(() => {
    if (autoRefresh && isOutdated) {
      handleRefresh(1000).catch(e => console.error(e));
    }
  }, [card, autoRefresh, isOutdated, handleRefresh]);

  return (
    <div className={`w-full ${card.layout.isDualRenderLayout() ? 'max-w-180' : 'max-w-90'} mx-auto space-y-3`}>
      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          disabled={isRendering}
          onClick={() => handleRefresh()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRendering ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" className="opacity-25"></circle>
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
              </svg>
              Rendering...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Preview
            </>
          )}
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          Auto-refresh
        </label>
      </div>

      {error && (
        <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-800">{error}</span>
          </div>
          <button
            onClick={() => handleRefresh()}
            className="px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Preview area */}
      <div className={`flex justify-center gap-3`}>
        {isRendering ? (<>
          {(card.layout.isDualRenderLayout() ? [0, 1] : [0]).map((_, index) => (
          <div
            key={index}
            className={`aspect-[63/88] w-full bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center space-y-3`}
          >
            <svg className="w-8 h-8 text-gray-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Rendering preview...</p>
              <p className="text-xs text-gray-500">This may take a few seconds</p>
            </div>
          </div>
          ))}
        </>) : image ? (
          <>
            <div className={`relative w-full`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`${card.faces[0].name} preview`}
                className={`aspect-[63/88] shadow-xl w-full bg-zinc-50 rounded-2xl border transition-all duration-300 ${
                  isOutdated ? 'opacity-40 ring-2 ring-amber-300' : ''
                }`}
                src={image}
              />
              {isOutdated && (
                <div className="absolute top-[13%] right-[10%] px-3 py-0.5 bg-amber-100 border border-amber-300 rounded">
                  <span className="text-xs font-medium text-amber-800">Outdated</span>
                </div>
              )}
            </div>
            {card.faces[1] && image2 && (
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${card.faces[1].name} preview`}
                  className={`aspect-[63/88] shadow-xl w-full bg-zinc-50 rounded-2xl border transition-all duration-300 ${
                    isOutdated ? 'opacity-40 ring-2 ring-amber-300' : ''
                  }`}
                  src={image2}
                />
                {isOutdated && (
                  <div className="absolute top-[13%] right-[10%] px-3 py-0.5 bg-amber-100 border border-amber-300 rounded">
                    <span className="text-xs font-medium text-amber-800">Outdated</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : !error ? (
          <div className={`aspect-[63/88] w-full bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center`}>
            <div className="text-center space-y-2">
              <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500">Click &ldquo;Refresh Preview&rdquo; to render</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Status indicators */}
      {isOutdated && !isRendering && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded mx-auto">
          <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm text-amber-800 font-medium">
            {autoRefresh ? 'Auto-updating in progress...' : 'Preview is outdated'}
          </span>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-gray-500 text-center">
        {autoRefresh
          ? 'Preview will automatically update when you make changes'
          : 'Enable auto-refresh or click the button to update the preview'
        }
      </p>
    </div>
  );
}
