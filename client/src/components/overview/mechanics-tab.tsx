"use client";

import { useMemo, useState } from 'react';
import { SerializedCard, aggregateMechanics } from 'kindred-paths';
import { MechanicsGrid } from './mechanics-grid';
import { useLocalStorageState } from '@/utils/use-local-storage-state';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';

export function MechanicsTab(props: { cards: SerializedCard[] }) {
  // Persist all settings in localStorage
  const [includeKeywords, setIncludeKeywords] = useLocalStorageState<boolean>('mechanics/includeKeywords', false);
  const [showNormalized, setShowNormalized] = useLocalStorageState<boolean>('mechanics/showNormalized', true);
  const [hideCostMechanics, setHideCostMechanics] = useLocalStorageState<boolean>('mechanics/hideCostMechanics', true);
  const [thresholdPercentage, setThresholdPercentage] = useLocalStorageState<number>('mechanics/thresholdPercentage', 2);
  
  // Rarity weights (default: C:6, U:3, R:2, M:1)
  const [commonWeight, setCommonWeight] = useLocalStorageState<number>('mechanics/weight/common', 6);
  const [uncommonWeight, setUncommonWeight] = useLocalStorageState<number>('mechanics/weight/uncommon', 3);
  const [rareWeight, setRareWeight] = useLocalStorageState<number>('mechanics/weight/rare', 2);
  const [mythicWeight, setMythicWeight] = useLocalStorageState<number>('mechanics/weight/mythic', 1);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);

  // Separate tokens from regular cards
  const { tokens, nonTokenCards } = useMemo(() => {
    const tokens = props.cards.filter(c => c.isToken);
    const nonTokenCards = props.cards.filter(c => !c.isToken);
    return { tokens, nonTokenCards };
  }, [props.cards]);

  // Calculate total weighted score based on cards (not mechanics)
  // This ensures percentages don't change when toggling "include keywords"
  const cardBasedWeightedScore = useMemo(() => {
    const rarityCounts = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
    
    for (const card of nonTokenCards) {
      rarityCounts[card.rarity]++;
    }
    
    return (
      rarityCounts.common * commonWeight +
      rarityCounts.uncommon * uncommonWeight +
      rarityCounts.rare * rareWeight +
      rarityCounts.mythic * mythicWeight
    );
  }, [nonTokenCards, commonWeight, uncommonWeight, rareWeight, mythicWeight]);

  // Aggregate mechanics data
  const aggregation = useMemo(() => {
    return aggregateMechanics(nonTokenCards, {
      includeKeywords,
      tokens,
      excludeCostOnlyMechanics: hideCostMechanics,
      rarityWeights: {
        common: commonWeight,
        uncommon: uncommonWeight,
        rare: rareWeight,
        mythic: mythicWeight,
      },
    });
  }, [nonTokenCards, includeKeywords, tokens, hideCostMechanics, commonWeight, uncommonWeight, rareWeight, mythicWeight]);

  // Calculate absolute threshold from percentage (based on card weights)
  const absoluteThreshold = useMemo(() => {
    if (cardBasedWeightedScore === 0) return 0;
    return Math.ceil((thresholdPercentage / 100) * cardBasedWeightedScore);
  }, [thresholdPercentage, cardBasedWeightedScore]);

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-slate-900">Mechanics Overview</h3>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <FontAwesomeIcon icon={faCog} />
            Settings
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-blue-600">{aggregation.totalMechanics}</span>
            <span className="text-sm text-slate-600">total mechanics</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-700">{aggregation.uniqueMechanics}</span>
            <span className="text-sm text-slate-600">unique mechanics</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-slate-700">{aggregation.colorCombinations.length}</span>
            <span className="text-sm text-slate-600">color combinations</span>
          </div>
        </div>

        {tokens.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700 mr-2">
              Note
            </span>
            Mechanics from <strong className="text-slate-900">{tokens.length}</strong> token
            {tokens.length === 1 ? '' : 's'} are included via their creating cards.
          </div>
        )}
      </div>

      {/* Grid Section */}
      <MechanicsGrid
        aggregation={aggregation}
        threshold={absoluteThreshold}
        showNormalized={showNormalized}
        totalWeightedScore={cardBasedWeightedScore}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSettings(false);
          }}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Mechanics Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Display Options */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Display Options</h3>
                
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={includeKeywords}
                    onChange={(e) => setIncludeKeywords(e.target.checked)}
                    className="rounded border-slate-300 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Include keywords</div>
                    <div className="text-xs text-slate-500">Show keyword abilities like Flying, Trample, etc.</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={showNormalized}
                    onChange={(e) => setShowNormalized(e.target.checked)}
                    className="rounded border-slate-300 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Show normalized text</div>
                    <div className="text-xs text-slate-500">Display as &ldquo;Scry N&rdquo; instead of &ldquo;Scry 1&rdquo;, &ldquo;Scry 2&rdquo;, etc.</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={hideCostMechanics}
                    onChange={(e) => setHideCostMechanics(e.target.checked)}
                    className="rounded border-slate-300 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Hide activation costs</div>
                    <div className="text-xs text-slate-500">Filter out {'{T}'}, {'{2}'}, {'{W}{W}'}, and other cost-only mechanics</div>
                  </div>
                </label>
              </div>

              {/* Prominence Threshold */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Prominence Threshold</h3>
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={thresholdPercentage}
                      onChange={(e) => setThresholdPercentage(Number(e.target.value))}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={thresholdPercentage}
                        onChange={(e) => setThresholdPercentage(Number(e.target.value))}
                        className="w-20 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <span className="text-sm text-slate-600">%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Mechanics with a weighted score of <strong>{thresholdPercentage}%</strong> ({absoluteThreshold}+) of the total are shown prominently (bold, larger). 
                    Others are collapsed under &ldquo;unique mechanics&rdquo;.
                  </p>
                </div>
              </div>

              {/* Rarity Weights */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Rarity Weights</h3>
                <p className="text-xs text-slate-600">
                  Customize how rarity affects the weighted score used for sorting and prominence.
                </p>
                <div className="p-4 bg-slate-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Common</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={commonWeight}
                        onChange={(e) => setCommonWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Uncommon</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={uncommonWeight}
                        onChange={(e) => setUncommonWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Rare</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={rareWeight}
                        onChange={(e) => setRareWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-700">Mythic</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={mythicWeight}
                        onChange={(e) => setMythicWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-mono text-slate-600">
                      Formula: <strong>C×{commonWeight} + U×{uncommonWeight} + R×{rareWeight} + M×{mythicWeight}</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
