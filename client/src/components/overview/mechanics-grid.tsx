"use client";

import { MechanicsAggregation, Stage, MechanicsCell } from 'kindred-paths';
import { colorToTypographyColor, typographyColors } from '@/utils/typography';
import { CardColor, cardColors } from 'kindred-paths';

const stages: Stage[] = ['early', 'mid', 'late'];

const stageBadgeClasses: Record<Stage, string> = {
  early: 'bg-emerald-100 text-emerald-800',
  mid: 'bg-amber-100 text-amber-800',
  late: 'bg-red-100 text-red-800',
};

/**
 * Map a color string to a background color for display.
 */
function colorToBg(colorStr: string): string {
  if (colorStr === 'generic') {
    return typographyColors.get('colorless')!.main;
  }
  const parts = colorStr.split('+').filter(c => c !== 'colorless') as CardColor[];
  const mtgColors = parts.filter(c => (cardColors as readonly string[]).includes(c)) as CardColor[];
  return typographyColors.get(colorToTypographyColor(mtgColors))!.main;
}

/**
 * Format a color string for display.
 */
function formatColors(colorStr: string): string {
  return colorStr.split('+').map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ');
}

/**
 * Get the rarity abbreviation.
 */
function getRarityAbbr(rarity: string): string {
  return rarity.charAt(0).toUpperCase();
}

/**
 * Calculate row totals (sum across all colors for each stage).
 */
function calculateRowTotals(
  grid: Map<string, Map<Stage, MechanicsCell>>,
  colorCombinations: string[],
): Record<Stage, number> {
  const totals: Record<Stage, number> = { early: 0, mid: 0, late: 0 };
  
  for (const color of colorCombinations) {
    const stageMap = grid.get(color);
    if (stageMap) {
      for (const stage of stages) {
        const cell = stageMap.get(stage);
        if (cell) {
          totals[stage] += cell.total;
        }
      }
    }
  }
  
  return totals;
}

/**
 * Calculate column totals (sum across all stages for each color).
 */
function calculateColumnTotals(
  grid: Map<string, Map<Stage, MechanicsCell>>,
  colorCombinations: string[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  
  for (const color of colorCombinations) {
    const stageMap = grid.get(color);
    let colorTotal = 0;
    
    if (stageMap) {
      for (const stage of stages) {
        const cell = stageMap.get(stage);
        if (cell) {
          colorTotal += cell.total;
        }
      }
    }
    
    totals[color] = colorTotal;
  }
  
  return totals;
}

export function MechanicsGrid({ aggregation }: { aggregation: MechanicsAggregation }) {
  const { grid, colorCombinations } = aggregation;
  
  if (colorCombinations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <p className="text-sm text-slate-500 italic">
          No mechanics found in the current card collection.
        </p>
      </div>
    );
  }
  
  const rowTotals = calculateRowTotals(grid, colorCombinations);
  const columnTotals = calculateColumnTotals(grid, colorCombinations);
  const grandTotal = Object.values(rowTotals).reduce((sum, val) => sum + val, 0);
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b-2 border-slate-200">
              <th className="sticky left-0 z-20 bg-slate-50 text-left py-3 px-4 font-semibold text-slate-700 border-r border-slate-200">
                Stage
              </th>
              {colorCombinations.map((color) => (
                <th
                  key={color}
                  className="py-3 px-4 font-semibold text-slate-700 border-r border-slate-200 min-w-[200px]"
                  style={{ backgroundColor: colorToBg(color) + '20' }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className="inline-block px-2 py-1 rounded text-xs font-medium border border-slate-200"
                      style={{ backgroundColor: colorToBg(color) }}
                    >
                      {formatColors(color)}
                    </span>
                  </div>
                </th>
              ))}
              <th className="sticky right-0 z-20 bg-slate-100 py-3 px-4 font-semibold text-slate-700 text-center min-w-[80px]">
                Σ
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                <td className="sticky left-0 z-10 bg-white py-3 px-4 font-medium border-r border-slate-200">
                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded-full ${stageBadgeClasses[stage]}`}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </span>
                </td>
                {colorCombinations.map((color) => {
                  const cell = grid.get(color)?.get(stage);
                  return (
                    <td
                      key={color}
                      className="py-2 px-3 align-top border-r border-slate-200 bg-white"
                    >
                      {cell && cell.mechanics.length > 0 ? (
                        <div className="space-y-1.5">
                          {cell.mechanics.map((mech, idx) => (
                            <div key={idx} className="text-xs">
                              <div className="font-mono text-slate-700 mb-0.5 break-words">
                                {mech.original}:
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {mech.rarities.map((rc, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600"
                                  >
                                    <span className="font-semibold">{getRarityAbbr(rc.rarity)}</span>
                                    <span className="mx-0.5">:</span>
                                    <span>{rc.count}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          <div className="pt-1.5 mt-1.5 border-t border-slate-200 text-xs font-semibold text-slate-600">
                            Total: {cell.total}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic text-center py-2">—</div>
                      )}
                    </td>
                  );
                })}
                <td className="sticky right-0 z-10 bg-slate-50 py-3 px-4 text-center font-semibold text-slate-700">
                  {rowTotals[stage]}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-200">
              <td className="sticky left-0 z-20 bg-slate-100 py-3 px-4 font-semibold text-slate-700 border-r border-slate-200">
                Σ
              </td>
              {colorCombinations.map((color) => (
                <td
                  key={color}
                  className="py-3 px-4 text-center font-semibold text-slate-700 border-r border-slate-200"
                >
                  {columnTotals[color]}
                </td>
              ))}
              <td className="sticky right-0 z-20 bg-slate-200 py-3 px-4 text-center font-bold text-slate-900">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
