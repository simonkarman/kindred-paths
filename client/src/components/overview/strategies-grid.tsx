"use client";

import Link from 'next/link';
import React, { useRef, useState } from 'react';
import { CardColor, SerializedCard } from 'kindred-paths';
import { StrategyAggregation, StrategyBucketCell } from 'kindred-paths';
import { getFilterQuery, getFilterWeight } from 'kindred-paths';
import { typographyColors } from '@/utils/typography';
import { cardPath } from '@/utils/slugify';

interface StrategiesGridProps {
  aggregation: StrategyAggregation;
  cards: SerializedCard[];
  bucketLabels?: string[];
  editMode?: boolean;
  onEdit?: (strategyIndex: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onAddStrategy?: () => void;
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

const ALL_COLORS: CardColor[] = ['white', 'blue', 'black', 'red', 'green'];

/** Returns the card color key string for a given SerializedCard face (or 'colorless'). */
function getCardColorKey(card: SerializedCard, faceIndex: number): string {
  const face = card.faces[faceIndex];
  if (!face) return 'colorless';
  const given = face.givenColors ?? [];
  const mana = [...new Set(
    Object.keys(face.manaCost ?? {}).flatMap(k => {
      if (ALL_COLORS.includes(k as CardColor)) return [k as CardColor];
      // expand hybrid keys like "white/blue" into their component colors
      return (k.split('/') as CardColor[]).filter(p => ALL_COLORS.includes(p));
    })
  )];
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

type GroupedContribution = {
  color: string;
  contribution: number;
  filterWeight: number;
};

type GroupedCardRef = {
  cid: string;
  faceIndex: number;
  totalContribution: number;
  contributions: GroupedContribution[];
};

/** Groups cell.colors refs by card+face and collects per-color contributions. */
function groupCellRefs(cell: StrategyBucketCell): GroupedCardRef[] {
  const map = new Map<string, GroupedCardRef>();
  for (const colorEntry of cell.colors) {
    for (const ref of colorEntry.refs) {
      const key = `${ref.cid}-${ref.faceIndex}`;
      if (!map.has(key)) {
        map.set(key, { cid: ref.cid, faceIndex: ref.faceIndex, totalContribution: 0, contributions: [] });
      }
      const group = map.get(key)!;
      group.totalContribution += ref.contribution;
      group.contributions.push({ color: colorEntry.color, contribution: ref.contribution, filterWeight: ref.filterWeight });
    }
  }
  // Sort by total contribution descending
  return [...map.values()].sort((a, b) => b.totalContribution - a.totalContribution);
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
  const grouped = groupCellRefs(cell);
  const maxContrib = grouped.reduce((m, g) => Math.max(m, g.totalContribution), 0);

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
                {cell.total} unique card{cell.total !== 1 ? 's' : ''}
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
                  <th className="text-left py-1.5 font-medium">Contributions</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => {
                  const card = cardMap.get(group.cid);
                  const faceName = card?.faces[group.faceIndex]?.name ?? group.cid;
                  const isSecondaryFace = group.faceIndex > 0;
                  const opacity = maxContrib > 0 ? 0.25 + 0.75 * (group.totalContribution / maxContrib) : 1;
                  return (
                    <tr
                      key={`${group.cid}-${group.faceIndex}`}
                      className="border-b border-slate-100 hover:bg-white transition-colors"
                    >
                      <td className="py-1.5 pr-3 font-medium">
                        <Link
                          href={cardPath(group.cid, card?.faces[0].name ?? group.cid)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {faceName}
                        </Link>
                        {isSecondaryFace && (
                          <span className="ml-1.5 text-slate-400 font-normal">(back)</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-3">
                        {card && (
                          <span className="inline-flex items-center gap-1.5">
                            <ColorSwatch card={card} faceIndex={group.faceIndex} />
                            <span className="text-slate-500 capitalize">
                              {getCardColorKey(card, group.faceIndex)}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {group.contributions.map((contrib, ci) => (
                            <span
                              key={ci}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200"
                              style={{
                                ...getBubbleStyle(contrib.color),
                                opacity,
                              }}
                              title={`${contrib.color}: ${contrib.contribution.toFixed(4)}${contrib.filterWeight > 1 ? ` (×${contrib.filterWeight} weight)` : ''}`}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '0.5rem',
                                  height: '0.5rem',
                                  borderRadius: '50%',
                                  backgroundColor: 'rgba(0,0,0,0.25)',
                                  flexShrink: 0,
                                }}
                              />
                              <span className="text-slate-800 font-medium capitalize">{contrib.color}</span>
                              <span className="font-mono text-slate-600">{contrib.contribution.toFixed(2)}</span>
                              {contrib.filterWeight > 1 && (
                                <span className="text-slate-700 font-semibold">×{contrib.filterWeight}</span>
                              )}
                            </span>
                          ))}
                        </div>
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

export function StrategiesGrid({ aggregation, cards, bucketLabels, editMode, onEdit, onReorder, onAddStrategy }: StrategiesGridProps) {
  const { rows, buckets } = aggregation;
  const [selected, setSelected] = useState<{ rowIndex: number; cellIndex: number } | null>(null);
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);

  // Drag-and-drop state
  const dragFromRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

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

  // Total column count: [drag handle?] + strategy name + buckets + total + [edit?]
  const totalCols = buckets.length + 2 + (editMode ? 2 : 0);

  // Drag handlers
  function handleDragStart(rowIndex: number) {
    dragFromRef.current = rowIndex;
  }
  function handleDragOver(e: React.DragEvent, rowIndex: number) {
    e.preventDefault();
    setDragOver(rowIndex);
  }
  function handleDrop(toIndex: number) {
    const fromIndex = dragFromRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorder?.(fromIndex, toIndex);
      // If selected drill-down was open on a moved row, close it
      setSelected(null);
    }
    dragFromRef.current = null;
    setDragOver(null);
  }
  function handleDragEnd() {
    dragFromRef.current = null;
    setDragOver(null);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {editMode && <th className="w-8 px-2 py-3" />}
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
            {editMode && <th className="w-10 px-2 py-3" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const isRowSelected = selected?.rowIndex === rowIndex;
            const isDragTarget = dragOver === rowIndex;
            return (
              <React.Fragment key={rowIndex}>
                <tr
                  draggable={editMode}
                  onDragStart={editMode ? () => handleDragStart(rowIndex) : undefined}
                  onDragOver={editMode ? (e) => handleDragOver(e, rowIndex) : undefined}
                  onDrop={editMode ? () => handleDrop(rowIndex) : undefined}
                  onDragEnd={editMode ? handleDragEnd : undefined}
                  className={[
                    'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                    isDragTarget ? 'bg-blue-50 border-t-2 border-t-blue-400' : '',
                    editMode ? 'cursor-default' : '',
                  ].join(' ')}
                >
                  {/* Drag handle */}
                  {editMode && (
                    <td className="px-2 py-3 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing align-top">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 4a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zM7 9a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2zM7 14a1 1 0 100 2 1 1 0 000-2zm6 0a1 1 0 100 2 1 1 0 000-2z" />
                      </svg>
                    </td>
                  )}

                  {/* Strategy name + description */}
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-slate-900">{row.strategy.name}</div>
                    {row.strategy.description && (
                      <div className="text-xs text-slate-400 mt-0.5 leading-snug">
                        {row.strategy.description}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {row.strategy.filters.map((f, fi) => {
                        const query = getFilterQuery(f);
                        const weight = getFilterWeight(f);
                        return (
                          <code
                            key={fi}
                            className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                            title={weight > 1 ? `weight: ×${weight}` : undefined}
                          >
                            {query}{weight > 1 && <span className="ml-1 text-slate-400 font-semibold">×{weight}</span>}
                          </code>
                        );
                      })}
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

                  {/* Edit button */}
                  {editMode && (
                    <td className="px-2 py-3 text-center align-top">
                      <button
                        onClick={() => onEdit?.(rowIndex)}
                        title="Edit strategy"
                        className="text-slate-400 hover:text-blue-600 transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </td>
                  )}
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
              </React.Fragment>
            );
          })}

          {/* Add strategy row */}
          {editMode && (
            <tr className="border-b border-slate-100">
              <td colSpan={totalCols} className="px-4 py-2">
                <button
                  onClick={onAddStrategy}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add strategy
                </button>
              </td>
            </tr>
          )}

          {/* No-strategy row */}
          {unmatchedCards.length > 0 && (
            <>
              <tr
                className="border-b border-slate-100 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => setUnmatchedOpen(o => !o)}
              >
                {editMode && <td className="px-2 py-3" />}
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
                {editMode && <td className="px-2 py-3" />}
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
                                      href={cardPath(card.cid, card.faces[0].name)}
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
