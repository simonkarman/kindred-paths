import { CardColor, cardColors, Mana } from 'kindred-paths';

export const CardManaCostInput = (props: {
  manaCost: { [type in Mana]?: number },
  setManaCost: (value: { [type in Mana]?: number }) => void,
  getErrorMessage: (color: CardColor | 'colorless') => string | undefined
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardManaCost" className="block font-medium text-gray-800">
      Card Mana Cost
    </label>
    <div className="grid grid-cols-3 gap-2">
      {(['colorless', ...cardColors] as const).map((manaType) => (<div key={manaType}>
        <div className="flex items-center space-x-2">
          <label htmlFor={`manaCost-${manaType}`} className="text-sm capitalize">
            {manaType}
          </label>
          <input
            id={`manaCost-${manaType}`}
            type="number"
            min="0"
            value={props.manaCost[manaType as Mana] || 0}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              props.setManaCost({
                ...props.manaCost,
                [manaType]: isNaN(value) ? undefined : value,
              });
            }}
            className="w-full bg-white px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {props.getErrorMessage(manaType) && (
          <p className="text-red-700 text-xs mb-2">
            {props.getErrorMessage(manaType)}
          </p>
        )}
      </div>))}
    </div>
  </div>;
}
