import { CardSuperType, CardType } from 'kindred-paths';

export const CardSupertypeInput = (props: {
  supertype: 'basic' | 'legendary' | undefined,
  setSupertype: (value: CardSuperType) => void,
  types: [CardType, ...CardType[]],
  getErrorMessage: () => string | undefined,
}) => {
  return <div className="space-y-1">
    <label className="block font-medium text-zinc-800">
      Card Super Type
    </label>
    <div className="space-y-2 flex items-baseline gap-4">
      {/* Legendary checkbox */}
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={props.supertype === 'legendary'}
          onChange={(e) => {
            if (e.target.checked) {
              props.setSupertype('legendary');
            } else {
              props.setSupertype(undefined);
            }
          }}
          className="mr-2"
        />
        Legendary
      </label>

      {/* Basic checkbox - only show if types.length === 1 && types[0] === 'land' */}
      <label className="flex items-center">
        <input
          type="checkbox"
          disabled={props.types.length !== 1 || props.types[0] !== 'land'}
          checked={props.supertype === 'basic'}
          onChange={(e) => {
            if (e.target.checked) {
              props.setSupertype('basic');
            } else {
              props.setSupertype(undefined);
            }
          }}
          className="mr-2"
        />
        Basic
      </label>

    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
