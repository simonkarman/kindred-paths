import { CardColor, cardColors, Mana } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

export const CardManaCostInput = (props: {
  manaCost: { [type in Mana]?: number },
  setManaCost: (value: { [type in Mana]?: number }) => void,
  getErrorMessage: (color: CardColor | 'colorless') => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <div className="space-y-1">
    <InputHeader propertyName="mana cost" isChanged={props.isChanged} revert={props.revert} />
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
              const nextManaCost = { ...props.manaCost };
              if (isNaN(value) || value === 0) {
                delete nextManaCost[manaType as Mana];
              } else {
                nextManaCost[manaType as Mana] = value;
              }
              props.setManaCost(nextManaCost);
            }}
            className="w-full bg-white px-1 py-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
