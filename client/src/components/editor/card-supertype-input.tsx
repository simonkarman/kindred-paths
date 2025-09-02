import { CardSuperType, CardType } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';

export const CardSupertypeInput = (props: {
  supertype: CardSuperType,
  setSupertype: (value: CardSuperType) => void,
  types: [CardType, ...CardType[]],
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  const isPlaneswalker = props.types.includes('planeswalker');
  return <div className="space-y-1">
    <InputHeader propertyName="supertype" isChanged={props.isChanged} revert={props.revert} />
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
          disabled={isPlaneswalker}
        />
        Legendary
      </label>

      {/* Token checkbox */}
      <label className="flex items-center">
        <input
          type="checkbox"
          checked={props.supertype === 'token'}
          onChange={(e) => {
            if (e.target.checked) {
              props.setSupertype('token');
            } else {
              props.setSupertype(undefined);
            }
          }}
          className="mr-2"
          disabled={isPlaneswalker}
        />
        Token
      </label>

      {/* Basic checkbox - only show if types.length === 1 && types[0] === 'land' */}
      <label className="flex items-center">
        <input
          type="checkbox"
          disabled={isPlaneswalker || props.types.length !== 1 || props.types[0] !== 'land'}
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
