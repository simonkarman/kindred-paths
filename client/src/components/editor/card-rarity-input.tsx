import { cardRarities, CardRarity } from 'kindred-paths';
import { capitalize, typographyRarityColors } from '@/utils/typography';
import { InputHeader } from '@/components/editor/input-header';

export const CardRarityInput = (props: {
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic',
  setRarity: (value: CardRarity) => void,
  getErrorMessage: () => string | undefined,
  isChanged: boolean,
  revert: () => void,
}) => {
  return <div className="space-y-1">
    <InputHeader propertyName="rarity" isChanged={props.isChanged} revert={props.revert} />
    <div className="px-1 flex gap-4 w-full justify-between">
      {cardRarities.map(rarityOption => (
        <div key={rarityOption} className="flex gap-2 items-center">
          <input
            type="radio"
            id={`rarity-${rarityOption}`}
            name="cardRarity"
            value={rarityOption}
            checked={props.rarity === rarityOption}
            onChange={(e) => props.setRarity(e.target.value as CardRarity)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300"
            style={{
              accentColor: typographyRarityColors.get(rarityOption)?.[0],
            }}
          />
          <label
            htmlFor={`rarity-${rarityOption}`}
            className="text-sm font-medium cursor-pointer"
            style={{
              color: typographyRarityColors.get(rarityOption)?.[0],
            }}
          >
            {capitalize(rarityOption)}
          </label>
        </div>
      ))}
    </div>
    {props.getErrorMessage() && (
      <p className="text-red-700 text-xs">
        {props.getErrorMessage()}
      </p>
    )}
  </div>;
}
