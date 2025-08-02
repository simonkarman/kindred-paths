import { CardColor, cardColors } from 'kindred-paths';
import { InputHeader } from '@/components/editor/input-header';
import { capitalize } from '@/utils/typography';

export const CardTokenColorsInput = (props: {
  tokenColors: CardColor[],
  setTokenColors: (value: CardColor[]) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <div className="space-y-1">
    <InputHeader propertyName="Token Colors" isChanged={props.isChanged} revert={props.revert} />
    <div className="space-y-2 flex items-baseline gap-4">
      {/* White checkbox */}
      {cardColors.map(color => (
        <label key={color} className="flex items-center">
          <input
            type="checkbox"
            checked={props.tokenColors.includes(color)}
            onChange={(e) => {
              if (e.target.checked) {
                props.setTokenColors([...props.tokenColors, color]);
              } else {
                props.setTokenColors(props.tokenColors.filter(c => c !== color));
              }
            }}
            className="mr-2"
          />
          <span>
            {capitalize(color)}
          </span>
        </label>

      ))}
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
