"use client";

import { useMemo, useState } from 'react';
import { extractMechanics, MechanicEntry, SerializedCard, capitalize } from 'kindred-paths';
import { typographyColors, colorToTypographyColor } from '@/utils/typography';
import { CardColor, cardColors } from 'kindred-paths';

/**
 * Map a single color to its background color.
 */
function getSingleColorBg(color: string): string {
  if (color === 'colorless' || color === 'generic') {
    return typographyColors.get('colorless')!.main;
  }
  const cardColor = color as CardColor;
  if ((cardColors as readonly string[]).includes(cardColor)) {
    return typographyColors.get(`mono ${cardColor}`)!.main;
  }
  return typographyColors.get('colorless')!.main;
}

/**
 * Get individual colors from a color combination string.
 */
function getIndividualColors(colorStr: string): string[] {
  if (colorStr === 'generic') {
    return ['colorless'];
  }
  return colorStr.split('+').filter(c => c !== 'colorless');
}

/**
 * Format a single color name for display (first letter uppercase).
 */
function formatSingleColor(color: string): string {
  return color.charAt(0).toUpperCase();
}

const stageBadgeClasses: Record<string, string> = {
  early: 'bg-emerald-100 text-emerald-800',
  mid: 'bg-amber-100 text-amber-800',
  late: 'bg-red-100 text-red-800',
};

export function MechanicEntries({ serializedCard, tokens }: { serializedCard: SerializedCard, tokens: SerializedCard[] }) {
  const [showNormalized, setShowNormalized] = useState(false);
  const [includeKeywords, setIncludeKeywords] = useState(false);

  const entries = useMemo(() =>
    extractMechanics(serializedCard, { includeKeywords, tokens }),
    [serializedCard, includeKeywords, tokens],
  );

  const controls = <div className="flex flex-wrap items-center gap-4 text-sm">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={showNormalized}
        onChange={(e) => setShowNormalized(e.target.checked)}
        className="rounded border-slate-300"
      />
      <span className="text-slate-600">Show normalized text</span>
    </label>
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={includeKeywords}
        onChange={(e) => setIncludeKeywords(e.target.checked)}
        className="rounded border-slate-300"
      />
      <span className="text-slate-600">Include keywords</span>
    </label>
    <span className="text-slate-400">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </span>
  </div>;

  if (serializedCard.isToken) {
    return (
      <p className="text-sm text-slate-500 italic">
        Token cards produce no standalone mechanic entries. Their mechanics are extracted through the cards that create them.
      </p>
    );
  }

  if (entries.length === 0) {
    return (<div className="space-y-4">
      {controls}
      <p className="text-sm text-slate-500 italic">
        No mechanic entries extracted from this card.
      </p>
    </div>);
  }

  // Group entries by source face
  const groupedByFace = new Map<number, MechanicEntry[]>();
  for (const entry of entries) {
    const key = entry.source.faceIndex;
    if (!groupedByFace.has(key)) groupedByFace.set(key, []);
    groupedByFace.get(key)!.push(entry);
  }

  // Check if any entries come from a different card (tokens)
  const hasTokenEntries = entries.some(e => e.source.cid !== serializedCard.cid);

  return (
    <div className="space-y-4">
      {controls}

      {/* Entry table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 pr-3 font-medium text-slate-500">Fragment</th>
              <th className="text-left py-2 px-3 font-medium text-slate-500">Colors</th>
              <th className="text-left py-2 px-3 font-medium text-slate-500">Stage</th>
              <th className="text-right py-2 px-3 font-medium text-slate-500">Turn</th>
              {hasTokenEntries && (
                <th className="text-left py-2 pl-3 font-medium text-slate-500">Source</th>
              )}
            </tr>
          </thead>
          <tbody>
            {[...groupedByFace.entries()].map(([faceIndex, faceEntries]) => {
              const faceName = serializedCard.faces[faceIndex]?.name;
              const showFaceHeader = groupedByFace.size > 1 || hasTokenEntries;
              return (
                <Fragment key={faceIndex} faceIndex={faceIndex}>
                  {showFaceHeader && (
                    <tr>
                      <td
                        colSpan={hasTokenEntries ? 5 : 4}
                        className="pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide"
                      >
                        {faceName ?? `Face ${faceIndex}`}
                      </td>
                    </tr>
                  )}
                  {faceEntries
                    .toSorted((a, b) => a.colors.localeCompare(b.colors)) // TODO: sort on wubrg
                    .map((entry, i) => {
                    const isTokenSource = entry.source.cid !== serializedCard.cid;
                    return (
                      <tr
                        key={i}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-1.5 pr-3">
                          <code className="text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded break-all">
                            {showNormalized ? entry.fragment.normalized : entry.fragment.original}
                          </code>
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1">
                            {getIndividualColors(entry.colors).map((c, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold border border-slate-300"
                                style={{ backgroundColor: getSingleColorBg(c) }}
                              >
                                {formatSingleColor(c)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${stageBadgeClasses[entry.stage]}`}>
                            {capitalize(entry.stage)}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs text-slate-600">
                          T{entry.earliestTurn}
                        </td>
                        {hasTokenEntries && (
                          <td className="py-1.5 pl-3 text-xs text-slate-500">
                            {isTokenSource ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs">
                                {entry.source.cardName}
                              </span>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Simple fragment wrapper to avoid importing React.Fragment in JSX.
 */
function Fragment({ children }: { children: React.ReactNode; faceIndex: number }) {
  return <>{children}</>;
}
