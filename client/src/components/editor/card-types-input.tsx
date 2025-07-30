import { CardType, cardTypes } from 'kindred-paths';
import { capitalize } from '@/utils/typography';
import { InputHeader } from '@/components/editor/input-header';

export const CardTypesInput = (props: {
  types: [CardType, ...CardType[]],
  setTypes: (value: [CardType, ...CardType[]]) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <div className="space-y-1">
    <InputHeader propertyName="type" isChanged={props.isChanged} revert={props.revert} />
    <div>
      <select
        id="cardTypes"
        className="w-full bg-white h-31 px-1 pt-0.5 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        multiple
        value={props.types}
        onChange={(e) => {
          const selectedOptions = Array.from(e.target.selectedOptions, option => option.value as CardType);
          if (selectedOptions.length === 0) {
            selectedOptions.push('creature'); // Ensure at least one type is always selected
          }
          props.setTypes([selectedOptions[0], ...selectedOptions.slice(1)] as [CardType, ...CardType[]]);
        }}
      >
        {cardTypes.map(type => (
          <option key={type} value={type}>
            {capitalize(type)}
          </option>
        ))}
      </select>
      <p className="text-right text-xs text-zinc-500 italic">(hold Ctrl or Cmd to select multiple)</p>
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
