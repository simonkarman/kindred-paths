import { cardColors, Mana } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

// Color mapping for mana types
const manaTypeColors: Record<Mana, { bg: string; border: string; text: string; symbol: string }> = {
  colorless: { bg: '', border: 'border-stone-100', text: 'text-stone-800', symbol: 'C' },
  x: { bg: '', border: 'border-zinc-100', text: 'text-zinc-800', symbol: 'X' },
  white: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', symbol: 'W' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', symbol: 'U' },
  black: { bg: 'bg-zinc-50', border: 'border-gray-200', text: 'text-gray-800', symbol: 'B' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', symbol: 'R' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', symbol: 'G' },
};

export const CardManaCostInput = (props: {
  manaCost: { [type in Mana]?: number },
  setManaCost: (value: { [type in Mana]?: number }) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const updateManaValue = (manaType: Mana, value: string) => {
    const numValue = parseInt(value, 10);
    const nextManaCost = { ...props.manaCost };
    if (isNaN(numValue) || numValue === 0) {
      delete nextManaCost[manaType];
    } else {
      nextManaCost[manaType] = numValue;
    }
    props.setManaCost(nextManaCost);
  };

  return (
    <div className="space-y-1">
      <InputHeader propertyName="mana cost" isChanged={props.isChanged} revert={props.revert} />

      {/* Mana type inputs */}
      <div className="grid grid-cols-3 gap-1">
        {(['colorless', 'x', undefined, ...cardColors] as const).map((manaType, i) => {
          if (manaType === undefined) {
            return <div key={i} />; // Leave empty space for undefined mana types
          }

          const colors = manaTypeColors[manaType];
          const currentValue = props.manaCost[manaType] || 0;

          return (
            <div key={manaType} className="space-y-1">
              <div className={`flex items-center justify-center gap-3 p-2 rounded-lg border-2 ${colors.bg} ${colors.border}`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full border-2 ${colors.border} ${colors.bg} flex items-center justify-center`}>
                    <span className={`text-xs font-bold ${colors.text}`}>
                      {colors.symbol}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    id={`manaCost-${manaType}`}
                    type="number"
                    min="0"
                    max="20"
                    value={currentValue || ''}
                    onChange={(e) => updateManaValue(manaType, e.target.value)}
                    placeholder="0"
                    className="w-24 bg-white px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-300"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};
