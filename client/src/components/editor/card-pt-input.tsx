import { InputHeader } from '@/components/editor/input-header';

export const CardPTInput = (props: {
  pt: { power: number, toughness: number },
  setPt: (value: { power: number, toughness: number }) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const handlePowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      props.setPt({
        ...props.pt,
        power: 0,
      });
      return;
    }

    const power = parseInt(value, 10);
    if (!isNaN(power) && power >= 0) {
      props.setPt({
        ...props.pt,
        power,
      });
    }
  };

  const handleToughnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      props.setPt({
        ...props.pt,
        toughness: 0,
      });
      return;
    }

    const toughness = parseInt(value, 10);
    if (!isNaN(toughness) && toughness >= 0) {
      props.setPt({
        ...props.pt,
        toughness,
      });
    }
  };

  const setPreset = (power: number, toughness: number) => {
    props.setPt({ power, toughness });
  };

  const commonPresets = [
    { power: 0, toughness: 0 },
    { power: 1, toughness: 1 },
    { power: 2, toughness: 2 },
    { power: 3, toughness: 3 },
    { power: 4, toughness: 4 },
    { power: 5, toughness: 5 },
    { power: 6, toughness: 6 },
  ];

  return (
    <div className="space-y-1">
      <InputHeader propertyName="Power / Toughness" isChanged={props.isChanged} revert={props.revert} />

      {/* Main P/T Input */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <div className="flex-1">
            <input
              id="power"
              type="number"
              min="0"
              value={props.pt.power}
              onChange={handlePowerChange}
              className="w-full bg-white px-3 py-1 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono"
            />
          </div>

          <div className="flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-400">/</span>
          </div>

          <div className="flex-1">
            <input
              id="toughness"
              type="number"
              min="0"
              value={props.pt.toughness}
              onChange={handleToughnessChange}
              className="w-full bg-white px-3 py-1 border border-zinc-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap justify-between gap-1">
          {commonPresets.map(({ power, toughness }) => (
            <button
              key={`${power}-${toughness}`}
              type="button"
              onClick={() => setPreset(power, toughness)}
              className={`px-2 py-0.5 text-xs rounded border font-mono transition-colors ${
                props.pt.power === power && props.pt.toughness === toughness
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {power}/{toughness}
            </button>
          ))}
        </div>
      </div>

      {props.getErrorMessage() && (
        <p className="text-red-700 text-xs">
          {props.getErrorMessage()}
        </p>
      )}
    </div>
  );
};
