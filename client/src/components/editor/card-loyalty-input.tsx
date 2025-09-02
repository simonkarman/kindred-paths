import { InputHeader } from '@/components/editor/input-header';

export const CardLoyaltyInput = (props: {
  loyalty: number,
  setLoyalty: (value: number) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      props.setLoyalty(0);
      return;
    }

    const loyalty = parseInt(value, 10);
    if (!isNaN(loyalty) && loyalty >= 0) {
      props.setLoyalty(loyalty);
    }
  };

  const commonPresets = [1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="space-y-1">
      <InputHeader propertyName="Loyalty" isChanged={props.isChanged} revert={props.revert} />

      {/* Main Loyalty Input */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <div className="flex-1">
            <input
              id="loyalty"
              type="number"
              min="1"
              value={props.loyalty}
              onChange={handleChange}
              className="w-full bg-white px-3 py-1 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap justify-between gap-1">
          {commonPresets.map((loyalty) => (
            <button
              key={`${loyalty}`}
              type="button"
              onClick={() => props.setLoyalty(loyalty)}
              className={`px-2 py-0.5 text-xs rounded border font-mono transition-colors ${
                props.loyalty === loyalty
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {loyalty}
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
