type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';
type Color = 'white' | 'blue' | 'black' | 'red' | 'green';
type Type = 'creature' | 'enchantment' | 'artifact' | 'instant' | 'sorcery' | 'land';

/**
 * A slot for a card in a set.
 *
 * A slot describes the characteristics that the card occupying the slot must adhere to. A slot can be occupied by
 *  exactly zero or one cards. If a slot is not occupied by a card, it is considered open.
 *
 * A card can occupy a single slot in a set.
 */
type Slot = {
  /**
   * The unique id for this slot in the set.
   *
   * The ids range from 1 to the number of slots in the set.
   */
  id: number;

  /**
   * The rarity of the card that can occupy this slot.
   */
  rarity: Rarity;

  /**
   * The color identity of the card that can occupy this slot.
   *
   * The color identity must match exactly. Example: A color identity with black and green must have those colors
   *  and must not use any of the other colors.
   *
   * An empty array means that card is colorless.
   */
  colorIdentity: Color[];

  /**
   * The minimum types of the card that can occupy this slot.
   *
   * The given types must be present in the card's types. The card can have additional types, but it must have at least
   *  the types specified here.
   */
  types: Type[];

  /**
   * The subtypes of the card that can occupy this slot.
   *
   * The given subtypes must be present in the card's subtypes. The card can have additional subtypes, but it must have at
   *  least the subtypes specified here.
   */
  subtypes: string[];

  /**
   * The mana value of at least one of the casting costs of the card that can occupy this slot.
   *
   * Both the minimum and maximum mana value are inclusive. The card can have additional casting costs, but it must have at
   *  least one of its mana costs within the specified range.
   */
  manaValue: number | {
    /**
     * The inclusive minimum mana value of the card occupying this slot.
     */
    min: number;

    /**
     * The inclusive maximum mana value of the card occupying this slot.
     */
    max: number;
  }
}
