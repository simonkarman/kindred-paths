import { cardColors, HybridMana, hybridManaTypes, Mana } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

// Color mapping for mana types
const manaTypeColors: Record<Mana, { bg: string; border: string; text: string; symbol: string }> = {
  generic: { bg: '', border: 'border-stone-300', text: 'text-stone-800', symbol: '' },
  colorless: { bg: '', border: 'border-stone-100', text: 'text-stone-800', symbol: '◇' },
  x: { bg: '', border: 'border-zinc-100', text: 'text-zinc-800', symbol: 'X' },
  white: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', symbol: 'W' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', symbol: 'U' },
  black: { bg: 'bg-zinc-50', border: 'border-gray-200', text: 'text-gray-800', symbol: 'B' },
  red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', symbol: 'R' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', symbol: 'G' },
  // Hybrid mana types
  'white/blue': { bg: '', border: 'border-yellow-200', text: 'text-blue-800', symbol: 'W/U' },
  'blue/black': { bg: '', border: 'border-blue-200', text: 'text-gray-800', symbol: 'U/B' },
  'black/red': { bg: '', border: 'border-gray-200', text: 'text-red-800', symbol: 'B/R' },
  'red/green': { bg: '', border: 'border-red-200', text: 'text-green-800', symbol: 'R/G' },
  'green/white': { bg: '', border: 'border-green-200', text: 'text-yellow-800', symbol: 'G/W' },
  'white/black': { bg: '', border: 'border-yellow-200', text: 'text-gray-800', symbol: 'W/B' },
  'blue/red': { bg: '', border: 'border-blue-200', text: 'text-red-800', symbol: 'U/R' },
  'black/green': { bg: '', border: 'border-gray-200', text: 'text-green-800', symbol: 'B/G' },
  'red/white': { bg: '', border: 'border-red-200', text: 'text-yellow-800', symbol: 'R/W' },
  'green/blue': { bg: '', border: 'border-green-200', text: 'text-blue-800', symbol: 'G/U' },
};

const hybridColorBg: Record<HybridMana, string> = {
  'white/blue': 'linear-gradient(135deg, rgb(236,230,179) 50%, rgb(171,225,250) 50%)',
  'blue/black': 'linear-gradient(135deg, rgb(171,225,250) 50%, rgb(204,195,192) 50%)',
  'black/red': 'linear-gradient(135deg, rgb(204,195,192) 50%, rgb(249,172,144) 50%)',
  'red/green': 'linear-gradient(135deg, rgb(249,172,144) 50%, rgb(156,212,176) 50%)',
  'green/white': 'linear-gradient(135deg, rgb(156,212,176) 50%, rgb(236,230,179) 50%)',
  'white/black': 'linear-gradient(135deg, rgb(236,230,179) 50%, rgb(204,195,192) 50%)',
  'blue/red': 'linear-gradient(135deg, rgb(171,225,250) 50%, rgb(249,172,144) 50%)',
  'black/green': 'linear-gradient(135deg, rgb(204,195,192) 50%, rgb(156,212,176) 50%)',
  'red/white': 'linear-gradient(135deg, rgb(249,172,144) 50%, rgb(236,230,179) 50%)',
  'green/blue': 'linear-gradient(135deg, rgb(156,212,176) 50%, rgb(171,225,250) 50%)',
};

export const CardManaCostInput = (props: {
  manaCost: { [type in Mana]?: number } | undefined,
  setManaCost: (value: { [type in Mana]?: number } | undefined) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const manaCost = props.manaCost;

  const updateManaValue = (manaType: Mana, value: string) => {
    const numValue = parseInt(value, 10);
    const nextManaCost = { ...manaCost };
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

      {/* No mana cost button */}
      {manaCost === undefined && <>
        <button
          onClick={() => props.setManaCost({})}
          className="mb-2 text-xs text-blue-600 hover:underline"
        >
          Switch to have a mana cost
        </button>
        <p className="text-gray-500 text-sm italic">This card has no mana cost.</p>
      </>}

      {/* Mana type inputs */}
      {manaCost !== undefined && <>
        <button
          onClick={() => props.setManaCost(undefined)}
          className="mb-2 text-xs text-blue-600 hover:underline"
        >
          Switch to not have a mana cost
        </button>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {(['generic', 'colorless', 'x', ...cardColors] as const).map((manaType, i) => {
            if (manaType === undefined) {
              return <div key={i} />; // Leave empty space for undefined mana types
            }

            const colors = manaTypeColors[manaType];
            const currentValue = manaCost[manaType] || 0;

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
                      className="w-16 sm:w-16 bg-white px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-300"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hybrid mana section */}
        <details className="mt-2">
          <summary className="text-xs text-blue-600 cursor-pointer hover:underline">Hybrid mana</summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1">
            {hybridManaTypes.map((manaType) => {
              const colors = manaTypeColors[manaType];
              const currentValue = manaCost[manaType] || 0;

              return (
                <div key={manaType} className="space-y-1">
                  <div
                    className={`flex items-center justify-center gap-3 p-2 rounded-lg border-2 ${colors.border}`}
                    style={{ background: hybridColorBg[manaType] }}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full border-2 ${colors.border} flex items-center justify-center`}
                        style={{ background: hybridColorBg[manaType] }}
                      >
                        <span className={`font-bold ${colors.text}`} style={{ fontSize: '0.55rem' }}>
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
                        className="w-16 sm:w-16 bg-white px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-zinc-300"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      </>}

      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};
