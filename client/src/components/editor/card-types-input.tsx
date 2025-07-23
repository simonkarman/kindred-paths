import { CardType, cardTypes } from 'kindred-paths';
import { capitalize } from '@/utils/typography';

export const CardTypesInput = (props: {
  types: [CardType, ...CardType[]],
  setTypes: (value: [CardType, ...CardType[]]) => void,
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label htmlFor="cardTypes" className="block font-medium text-gray-800">
      Card Type <span className="text-xs text-gray-500 italic">(hold Ctrl or Cmd to select multiple)</span>
    </label>
    <select
      id="cardTypes"
      className="w-full bg-white h-31 px-1 py-0.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
