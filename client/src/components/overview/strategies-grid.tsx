"use client";

import Link from 'next/link';
import { useState } from 'react';
import { CardColor, SerializedCard } from 'kindred-paths';
import { StrategyAggregation, StrategyBucketCell } from 'kindred-paths';
import { typographyColors } from '@/utils/typography';

interface StrategiesGridProps {
  aggregation: StrategyAggregation;
  cards: SerializedCard[];
  bucketLabels?: string[];
}

const FALLBACK_COLOR = 'rgb(238, 236, 235)';

/** Looks up the main color string for a single color name (e.g. "red", "colorless"). */
function lookupSingleColor(color: string): string {
  if (color === 'colorless') return typographyColors.get('colorless')?.main ?? FALLBACK_COLOR;
  return typographyColors.get(`mono ${color}` as `mono ${CardColor}`)?.main ?? FALLBACK_COLOR;
}

/**
 * Returns inline style(s) for a bubble background.
 * Multi-color entries like "red+blue" produce a CSS gradient split per part.
 */
function getBubbleStyle(color: string): React.CSSProperties {
  const parts = color.split('+');
  if (parts.length === 1) {
    return { backgroundColor: lookupSingleColor(color) };
  }
  const pct = 100 / parts.length;
  const stops = parts.map((p, i) =>
    `${lookupSingleColor(p.trim())} ${(i * pct).toFixed(1)}% ${((i + 1) * pct).toFixed(1)}%`
  );
  return { background: `linear-gradient(135deg, ${stops.join(', ')})` };
}

/** Returns the card color key string for a given SerializedCard face (or 'colorless'). */
function getCardColorKey(card: SerializedCard, faceIndex: number): string {
  const face = card.faces[faceIndex];
  if (!face) return 'colorless';
  const given = face.givenColors ?? [];
  const mana = Object.keys(face.manaCost ?? {}).filter(k =>
    ['white', 'blue', 'black', 'red', 'green'].includes(k)
  ) as CardColor[];
  const colors: CardColor[] = given.length > 0 ? given : mana;
  if (colors.length === 0) return 'colorless';
  if (colors.length === 1) return colors[0];
  return colors.join('+');
}

const BUBBLE_BASE_REM = 2.5;
const BUBBLE_MIN_REM = 1.25;
const BUBBLE_LABEL_MIN_REM = 1.5;

interface BucketCellContentProps {
  cell: StrategyBucketCell;
  globalMax: number;
}

/** Renders the colored circles in a single bucket cell (no click handling — handled by <td>). */
function BucketCellContent({ cell, globalMax }: BucketCellContentProps) {
  const isEmpty = cell.total === 0;
  const sorted = [...cell.colors].sort((a, b) => b.count - a.count);

  if (isEmpty) {
    return <span className="text-slate-200">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {sorted.map(({ color, count }) => {
        const scale = globalMax > 0 ? Math.sqrt(count / globalMax) : 1;
        const sizeRem = Math.max(BUBBLE_MIN_REM, BUBBLE_BASE_REM * scale);
        const showLabel = sizeRem >= BUBBLE_LABEL_MIN_REM;
        return (
          <span
            key={color}
            title={`${color} (${count})`}
            style={{
              ...getBubbleStyle(color),
              color: 'rgb(40, 40, 40)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: `${sizeRem}rem`,
              height: `${sizeRem}rem`,
              borderRadius: '50%',
              fontSize: '0.7rem',
              fontWeight: 600,
              border: '1px solid rgba(0,0,0,0.12)',
              flexShrink: 0,
            }}
          >
            {showLabel ? Math.round(count) : null}
          </span>
        );
      })}
    </div>
  );
}

/** Formats a bucket's names into a readable label (fallback when no override provided). */
function bucketLabel(bucketNames: string[]): string {
  if (bucketNames.includes('*')) return '*';
  const nums = bucketNames
    .map(n => (n.startsWith('mv:') ? parseInt(n.slice(3), 10) : NaN))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
  if (nums.length === 0) return bucketNames.join(', ');
  if (nums.length === 1) return `${nums[0]}`;
  return `${nums[0]}–${nums[nums.length - 1]}`;
}

/** Small colored swatch circle for a card face. */
function ColorSwatch({ card, faceIndex }: { card: SerializedCard; faceIndex: number }) {
  const colorKey = getCardColorKey(card, faceIndex);
  return (
    <span
      title={colorKey}
      style={{
        ...getBubbleStyle(colorKey),
        display: 'inline-block',
        width: '0.75rem',
        height: '0.75rem',
        borderRadius: '50%',
        border: '1px solid rgba(0,0,0,0.15)',
        flexShrink: 0,
        verticalAlign: 'middle',
      }}
    />
  );
}

/** Drill-down table for a selected cell. */
function DrillDownPanel({
  cell,
  strategyName,
  bucketLabel: bucketLabelText,
  cardMap,
  onClose,
  colSpan,
}: {
  cell: StrategyBucketCell;
  strategyName: string;
  bucketLabel: string;
  cardMap: Map<string, SerializedCard>;
  onClose: () => void;
  colSpan: number;
}) {
  // Sort refs by bucketName alphabetically
  const sortedRefs = [...cell.refs].sort((a, b) => a.bucketName.localeCompare(b.bucketName));

  // Find max contribution for opacity scaling
  const maxContrib = sortedRefs.reduce((m, r) => Math.max(m, r.contribution), 0);

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-slate-50 border-t border-b border-slate-200 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800">{strategyName}</span>
              <span className="mx-2 text-slate-400">/</span>
              <span className="text-slate-600">{bucketLabelText}</span>
              <span className="ml-3 text-xs text-slate-400">
                {cell.refs.length} ref{cell.refs.length !== 1 ? 's' : ''} · {cell.total} unique card{cell.total !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-left py-1.5 pr-3 font-medium">Card</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Color</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Face</th>
                  <th className="text-left py-1.5 pr-3 font-medium">Bucket</th>
                  <th className="text-right py-1.5 font-medium">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {sortedRefs.map((ref, i) => {
                  const card = cardMap.get(ref.cid);
                  const faceName = card?.faces[ref.faceIndex]?.name ?? ref.cid;
                  // Opacity scales with contribution: min 0.25, max 1.0
                  const opacity = maxContrib > 0 ? 0.25 + 0.75 * (ref.contribution / maxContrib) : 1;
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-white transition-colors">
                      <td className="py-1.5 pr-3 font-medium">
                        <Link
                          href={`/card/${ref.cid}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {faceName}
                        </Link>
                      </td>
                      <td className="py-1.5 pr-3">
                        {card && (
                          <span className="inline-flex items-center gap-1.5">
                            <ColorSwatch card={card} faceIndex={ref.faceIndex} />
                            <span className="text-slate-500 capitalize">
                              {getCardColorKey(card, ref.faceIndex)}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-slate-500">{ref.faceIndex}</td>
                      <td className="py-1.5 pr-3">
                        <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {ref.bucketName}
                        </code>
                      </td>
                      <td
                        className="py-1.5 text-right font-mono"
                        style={{ color: `rgba(30, 30, 30, ${opacity})` }}
                      >
                        {ref.contribution.toFixed(4)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function StrategiesGrid({ aggregation, cards, bucketLabels }: StrategiesGridProps) {
  const { rows, buckets } = aggregation;
  const [selected, setSelected] = useState<{ rowIndex: number; cellIndex: number } | null>(null);
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);

  // Build a cid → card lookup map
  const cardMap = new Map<string, SerializedCard>(cards.map(c => [c.cid!, c]));

  // Compute global max count across all cells and colors for bubble scaling
  let globalMax = 0;
  for (const row of rows) {
    for (const cell of row.buckets) {
      for (const { count } of cell.colors) {
        if (count > globalMax) globalMax = count;
      }
    }
  }

  // Compute unmatched cards (not present in any strategy row's refs)
  const matchedCids = new Set<string>();
  for (const row of rows) {
    for (const bucket of row.buckets) {
      for (const ref of bucket.refs) {
        matchedCids.add(ref.cid);
      }
    }
  }
  const unmatchedCards = cards.filter(c => c.cid && !matchedCids.has(c.cid));

  function handleCellClick(rowIndex: number, cellIndex: number) {
    if (selected?.rowIndex === rowIndex && selected?.cellIndex === cellIndex) {
      setSelected(null);
    } else {
      setSelected({ rowIndex, cellIndex });
    }
  }

  // Total column count: strategy name + buckets + total
  const totalCols = buckets.length + 2;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-3 font-semibold text-slate-700 min-w-[200px]">
              Strategy
            </th>
            {buckets.map((bucketNames, i) => (
              <th
                key={i}
                className="px-3 py-3 font-semibold text-slate-700 text-center min-w-[80px]"
              >
                {bucketLabels?.[i] ?? (
                  <span className="inline-flex items-center gap-1">
                    {!bucketNames.includes('*') && (
                      <span className="text-slate-400 text-xs font-normal">MV</span>
                    )}
                    {bucketLabel(bucketNames)}
                  </span>
                )}
              </th>
            ))}
            <th className="px-3 py-3 font-semibold text-slate-700 text-center min-w-[60px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isRowSelected = selected?.rowIndex === rowIndex;
            return (
              <>
                <tr
                  key={rowIndex}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  {/* Strategy name + description */}
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900">{row.strategy.name}</div>
                    {row.strategy.description && (
                      <div className="text-xs text-slate-400 mt-0.5 leading-snug">
                        {row.strategy.description}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {row.strategy.filters.map((f, fi) => (
                        <code
                          key={fi}
                          className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                        >
                          {f}
                        </code>
                      ))}
                    </div>
                  </td>

                  {/* Bucket cells */}
                  {row.buckets.map((cell, cellIndex) => {
                    const isCellSelected = isRowSelected && selected?.cellIndex === cellIndex;
                    const isEmpty = cell.total === 0;
                    return (
                      <td
                        key={cellIndex}
                        onClick={isEmpty ? undefined : () => handleCellClick(rowIndex, cellIndex)}
                        className={[
                          'px-2 py-2 text-center align-middle transition-colors',
                          isEmpty ? '' : 'cursor-pointer hover:bg-blue-50',
                          isCellSelected ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : '',
                        ].join(' ')}
                      >
                        <BucketCellContent cell={cell} globalMax={globalMax} />
                      </td>
                    );
                  })}

                  {/* Row total */}
                  <td className="px-3 py-3 text-center align-middle">
                    <span className={`font-semibold ${row.total > 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                      {row.total > 0 ? row.total : '—'}
                    </span>
                  </td>
                </tr>

                {/* Inline drill-down panel — inserted immediately after this row */}
                {isRowSelected && selected !== null && (() => {
                  const cell = row.buckets[selected.cellIndex];
                  const label = bucketLabels?.[selected.cellIndex] ?? bucketLabel(buckets[selected.cellIndex]);
                  return cell ? (
                    <DrillDownPanel
                      key={`drill-${rowIndex}`}
                      cell={cell}
                      strategyName={row.strategy.name}
                      bucketLabel={label}
                      cardMap={cardMap}
                      onClose={() => setSelected(null)}
                      colSpan={totalCols}
                    />
                  ) : null;
                })()}
              </>
            );
          })}

          {/* No-strategy row */}
          {unmatchedCards.length > 0 && (
            <>
              <tr
                className="border-b border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setUnmatchedOpen(o => !o)}
              >
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${unmatchedOpen ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <div>
                      <div className="font-medium text-slate-400 italic">No strategy</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Cards not matched by any strategy
                      </div>
                    </div>
                  </div>
                </td>
                {buckets.map((_, i) => (
                  <td key={i} className="px-2 py-2 text-center align-middle text-slate-300">
                    —
                  </td>
                ))}
                <td className="px-3 py-3 text-center align-middle">
                  <span className="font-semibold text-slate-500">{unmatchedCards.length}</span>
                </td>
              </tr>

              {/* Expanded unmatched card list */}
              {unmatchedOpen && (
                <tr>
                  <td colSpan={totalCols} className="p-0">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              <th className="text-left py-1.5 pr-3 font-medium">Card</th>
                              <th className="text-left py-1.5 pr-3 font-medium">Color</th>
                              <th className="text-left py-1.5 font-medium">Face</th>
                            </tr>
                          </thead>
                          <tbody>
                            {unmatchedCards.map((card) =>
                              card.faces.map((face, faceIndex) => (
                                <tr
                                  key={`${card.cid}-${faceIndex}`}
                                  className="border-b border-slate-100 hover:bg-white transition-colors"
                                >
                                  <td className="py-1.5 pr-3 font-medium">
                                    <Link
                                      href={`/card/${card.cid}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {face.name}
                                    </Link>
                                  </td>
                                  <td className="py-1.5 pr-3">
                                    <span className="inline-flex items-center gap-1.5">
                                      <ColorSwatch card={card} faceIndex={faceIndex} />
                                      <span className="text-slate-500 capitalize">
                                        {getCardColorKey(card, faceIndex)}
                                      </span>
                                    </span>
                                  </td>
                                  <td className="py-1.5 text-slate-500">{faceIndex}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
