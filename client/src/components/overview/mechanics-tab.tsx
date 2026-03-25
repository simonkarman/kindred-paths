"use client";

import { useMemo, useState } from 'react';
import { SerializedCard, aggregateMechanics } from 'kindred-paths';
import { MechanicsGrid } from './mechanics-grid';

export function MechanicsTab(props: { cards: SerializedCard[] }) {
  const [includeKeywords, setIncludeKeywords] = useState(false);
  
  // Separate tokens from regular cards
  const { tokens, nonTokenCards } = useMemo(() => {
    const tokens = props.cards.filter(c => c.isToken);
    const nonTokenCards = props.cards.filter(c => !c.isToken);
    return { tokens, nonTokenCards };
  }, [props.cards]);
  
  // Aggregate mechanics data
  const aggregation = useMemo(() => {
    return aggregateMechanics(nonTokenCards, { includeKeywords, tokens });
  }, [nonTokenCards, includeKeywords, tokens]);
  
  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Mechanics Overview</h3>
        <div className="flex flex-wrap items-end gap-6 mb-4">
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
        
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 text-sm pt-4 border-t border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeKeywords}
              onChange={(e) => setIncludeKeywords(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-slate-600">Include keywords</span>
          </label>
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
      <MechanicsGrid aggregation={aggregation} />
    </div>
  );
}
