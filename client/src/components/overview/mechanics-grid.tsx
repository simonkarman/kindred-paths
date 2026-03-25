"use client";

import { useCallback, useMemo, useState, useRef } from 'react';
import { MechanicsAggregation, Stage, MechanicWithRarity } from 'kindred-paths';
import { typographyColors } from '@/utils/typography';
import { CardColor, cardColors } from 'kindred-paths';
import { MechanicRow } from './mechanic-row';

const stages: Stage[] = ['early', 'mid', 'late'];

const stageBadgeClasses: Record<Stage, string> = {
  early: 'bg-emerald-100 text-emerald-800',
  mid: 'bg-amber-100 text-amber-800',
  late: 'bg-red-100 text-red-800',
};

interface MechanicsGridProps {
  aggregation: MechanicsAggregation;
  threshold: number;
  totalWeightedScore: number;
  showingNormalized: boolean;
}

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

/**
 * Split mechanics into prominent and unique based on threshold.
 * Uses weighted score (C×6 + U×3 + R×2 + M×1) instead of total count.
 */
function splitMechanics(
  mechanics: MechanicWithRarity[],
  threshold: number,
): { prominent: MechanicWithRarity[]; unique: MechanicWithRarity[] } {
  const prominent = mechanics.filter(m => m.weightedScore >= threshold);
  const unique = mechanics.filter(m => m.weightedScore < threshold);
  return { prominent, unique };
}

export function MechanicsGrid({ aggregation, threshold, totalWeightedScore, showingNormalized }: MechanicsGridProps) {
  const { grid, colorCombinations } = aggregation;

  // Track which mechanic is currently hovered (by normalized text)
  const [hoveredMechanic, setHoveredMechanic] = useState<string | null>(null);
  const activeInstanceIdRef = useRef<string | null>(null);

  // Track which color rows are expanded (instead of individual cells)
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());

  // Calculate which cells have hidden matches for the hovered mechanic
  const cellsWithHiddenMatches = useMemo(() => {
    if (!hoveredMechanic) {
      return new Set<string>();
    }

    const matches = new Set<string>();

    for (const [color, stageMap] of grid.entries()) {
      // Skip if this color row is already expanded
      if (expandedColors.has(color)) continue;

      for (const [stage, cell] of stageMap.entries()) {
        const cellKey = `${color}-${stage}`;

        // Check if any unique (hidden) mechanics match
        const { unique } = splitMechanics(cell.mechanics, threshold);
        const hasMatch = unique.some(m => m.mechanic === hoveredMechanic);

        if (hasMatch) {
          matches.add(cellKey);
        }
      }
    }

    return matches;
  }, [hoveredMechanic, grid, threshold, expandedColors]);

  // Toggle color row expansion (affects all cells in the row)
  const toggleColorRow = useCallback((color: string) => {
    setExpandedColors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(color)) {
        newSet.delete(color);
      } else {
        newSet.add(color);
      }
      return newSet;
    });
  }, []);

  // Handle mechanic hover with instance ID tracking
  const handleMechanicHover = useCallback((normalized: string | null, instanceId?: string) => {
    if (normalized === null) {
      // Only clear if this instance is the currently active one
      if (instanceId === activeInstanceIdRef.current) {
        setHoveredMechanic(null);
        activeInstanceIdRef.current = null;
      }
    } else {
      // Set the new hover and track which instance is active
      setHoveredMechanic(normalized);
      activeInstanceIdRef.current = instanceId || null;
    }
  }, []);

  if (colorCombinations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-sm text-slate-500 italic">
          No mechanics found in the current card collection.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b-2 border-slate-200">
            <th className="text-center py-3 px-4 font-semibold text-slate-700 border-r border-slate-200">
              Color
            </th>
            {stages.map((stage) => (
              <th
                key={stage}
                className="py-3 px-4 font-semibold text-slate-700 border-r border-slate-200 min-w-[250px]"
              >
                <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${stageBadgeClasses[stage]}`}>
                  {stage.charAt(0).toUpperCase() + stage.slice(1)} Game
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colorCombinations.map((color) => {
            const individualColors = getIndividualColors(color);
            return (
              <tr key={color} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-medium border-r border-slate-200">
                  <div className="flex items-center justify-center gap-1">
                    {individualColors.map((c, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border border-slate-300"
                        style={{ backgroundColor: getSingleColorBg(c) }}
                      >
                        {formatSingleColor(c)}
                      </span>
                    ))}
                  </div>
                </td>
                {stages.map((stage) => {
                const cell = grid.get(color)?.get(stage);
                const cellKey = `${color}-${stage}`;
                const isExpanded = expandedColors.has(color);

                if (!cell || cell.mechanics.length === 0) {
                  return (
                    <td
                      key={stage}
                      className="py-2 px-3 align-top border-r border-slate-200 bg-white"
                    >
                      <div className="text-xs text-slate-400 italic text-center py-2">—</div>
                    </td>
                  );
                }

                const { prominent, unique } = splitMechanics(cell.mechanics, threshold);
                const hasHiddenMatch = cellsWithHiddenMatches.has(cellKey);

                return (
                  <td
                    key={stage}
                    className="py-2 px-3 align-top border-r border-slate-200 bg-white"
                  >
                    <div className="space-y-1.5">
                      {/* Prominent mechanics */}
                      {prominent.map((mech, idx) => (
                        <MechanicRow
                          key={idx}
                          mechanic={mech}
                          isProminent={true}
                          isHighlighted={hoveredMechanic === mech.mechanic}
                          onHover={handleMechanicHover}
                          totalWeightedScore={totalWeightedScore}
                          showingNormalized={showingNormalized}
                        />
                      ))}

                      {/* Collapse/expand button for unique mechanics */}
                      {unique.length > 0 && (
                        <button
                          onClick={() => toggleColorRow(color)}
                          className={`relative w-full text-left text-xs px-2 py-1 rounded border transition-all ${
                            hasHiddenMatch 
                              ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700 hover:text-yellow-800' 
                              : 'bg-blue-50 hover:bg-blue-100 border-transparent text-blue-600 hover:text-blue-700'
                          }`}
                        >
                          {isExpanded ? '−' : '+'} {unique.length} {unique.length === 1 ? 'unique mechanic' : 'unique mechanics'}
                        </button>
                      )}

                      {/* Unique mechanics (when expanded) */}
                      {isExpanded && unique.length > 0 && (
                        <div className="space-y-1.5 pl-2 border-l-2 border-slate-200">
                          {unique.map((mech, idx) => (
                            <MechanicRow
                              key={idx}
                              mechanic={mech}
                              isProminent={false}
                              isHighlighted={hoveredMechanic === mech.mechanic}
                              onHover={handleMechanicHover}
                              totalWeightedScore={totalWeightedScore}
                              showingNormalized={showingNormalized}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
