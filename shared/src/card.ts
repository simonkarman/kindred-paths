import { SerializedCard } from './serialized-card';
import { CardColor, cardColors, Mana, toOrderedColors, wubrg } from './colors';

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export const cardRarities = ['common', 'uncommon', 'rare', 'mythic'] as const;

export type CardSuperType = undefined | 'basic' | 'token' | 'legendary';
export const cardSuperTypes = [undefined, 'basic', 'token', 'legendary'] as const;

export type CardType = 'enchantment' | 'artifact' | 'instant' | 'sorcery' | 'creature' | 'land' | 'planeswalker';
export const cardTypes = ['enchantment', 'artifact', 'creature', 'land', 'instant', 'sorcery', 'planeswalker'] as const;

export type TokenCardType = Exclude<CardType, 'instant' | 'sorcery' | 'planeswalker'>;
export const tokenCardTypes = ['enchantment', 'artifact', 'creature', 'land'] as const;

export const landSubtypes = ['plains', 'island', 'swamp', 'mountain', 'forest'] as const;
export const landSubtypeToColor = (type: typeof landSubtypes[number] | string): CardColor | undefined => ({
  plains: 'white',
  island: 'blue',
  swamp: 'black',
  mountain: 'red',
  forest: 'green',
}[type] as CardColor | undefined);

export const ruleVariants = ['reminder', 'keyword', 'ability', 'inline-reminder', 'flavor'] as const;
export type RuleVariant = 'reminder' | 'keyword' | 'ability' | 'inline-reminder' | 'flavor';
export type Rule = { variant: RuleVariant, content: string };
export type LoyaltyCost = number | '-X';
export const loyaltyCostAsString = (loyalty: LoyaltyCost): string => {
  if (typeof loyalty === 'string') {
    return loyalty;
  }
  if (loyalty >= 0) {
    return `+${loyalty}`;
  }
  return `${loyalty}`;
};
export const tryParseLoyaltyAbility = (rule: Rule): { success: false } | { success: true, cost: LoyaltyCost, content: string } => {
  const match = /^([+-][1-9]\d*?|^0|-X)(: )/[Symbol.match](rule.content);
  if (rule.variant === 'ability' && match !== null) {
    const cost = match[1];
    if (cost === '-X') {
      return {
        success: true,
        cost,
        content: rule.content.substring(match[0].length),
      };
    }
    const costAsNumber = parseInt(cost, 10);
    if (!isNaN(costAsNumber) && Number.isInteger(costAsNumber)) {
      return {
        success: true,
        cost: costAsNumber,
        content: rule.content.substring(match[0].length),
      };
    }
  }
  return { success: false };
};

const capitalize = (str: string) => str.length === 0 ? '' : str.charAt(0).toUpperCase() + str.slice(1);

export class Card {
  public readonly id: string;
  public readonly name: string;
  public readonly rarity: CardRarity;
  public readonly supertype: CardSuperType;
  public readonly tokenColors?: CardColor[];
  public readonly types: [CardType, ...CardType[]];
  public readonly subtypes: string[];
  public readonly manaCost: { [type in Mana]?: number };
  public readonly rules: Rule[];
  public readonly pt?: { power: number, toughness: number };
  public readonly loyalty?: number;
  public readonly collectorNumber: number;
  public readonly art?: string;
  public readonly tags: { [key: string]: string | number | boolean | undefined };

  constructor(props: SerializedCard) {
    this.id = props.id;
    this.name = props.name;
    this.rarity = props.rarity;
    this.supertype = props.supertype;
    this.tokenColors = props.tokenColors;
    this.types = props.types;
    this.subtypes = props.subtypes ?? [];
    this.manaCost = props.manaCost;
    this.rules = props.rules ?? [];
    this.pt = props.pt;
    this.loyalty = props.loyalty;
    this.collectorNumber = props.collectorNumber;
    this.art = props.art;
    this.tags = props.tags ?? {};

    // Check basic superType consistency
    if (this.supertype === 'basic') {
      if (!this.types.includes('land')) {
        throw new Error('super type basic must be associated with lands');
      }
      if (this.rarity !== 'common') {
        throw new Error('super type basic must have common rarity');
      }
    }

    // Check token superType consistency
    if (this.supertype === 'token') {
      if (this.rarity !== 'common') {
        throw new Error('super type token must have common rarity');
      }
      if (!tokenCardTypes.some(pct => this.types.includes(pct))) {
        throw new Error('super type token must be associated with a permanent type (enchantment, artifact, creature, land, planeswalker)');
      }
      if (this.tokenColors === undefined) {
        throw new Error('super type token must have token colors defined');
      }
      if (Object.keys(this.manaCost).length > 0) {
        throw new Error('token cards cannot have a mana cost');
      }
    }
    if (this.tokenColors && this.supertype !== 'token') {
      throw new Error('token colors can only be defined for token cards');
    }

    // Check that card has at least one type
    if (this.types.length === 0) {
      throw new Error('card must have at least one type');
    }
    if (this.types.length > 1) {
      // instance and sorcery cannot be combined with other types
      if (this.types.includes('instant') || this.types.includes('sorcery') || this.types.includes('planeswalker')) {
        throw new Error('instants, sorceries, and planeswalkers cannot be combined with other types');
      }

      // If there are multiple types, make sure that land always comes last
      if (this.types.includes('land') && this.types[this.types.length - 1] !== 'land') {
        throw new Error('if there are multiple types, land must always come last');
      }

      // If there is a creature type, it must be last, unless land is last, then it must be second to last
      if (this.types.includes('creature')) {
        if (
          this.types[this.types.length - 1] !== 'creature'
            && (this.types[this.types.length - 1] !== 'land' || this.types[this.types.length - 2] !== 'creature')
        ) {
          throw new Error('if there is a creature type, it must be last, unless land is last, then it must be second to last');
        }
      }
    }

    // Validate instant and sorceries don't have subtypes
    if ((this.types.includes('instant') || this.types.includes('sorcery')) && this.subtypes.length > 0) {
      throw new Error('instants and sorceries cannot have subtypes');
    }

    // Validate rules
    // if there is reminder text, it must always be first
    if (this.rules.some((rule, index) => index !== 0 && rule.variant === 'reminder')) {
      throw new Error('if there is reminder text, it must always be first in the rules');
    }
    // if there is inline-reminder text, it must always be after an ability or keyword
    if (this.rules.some((rule, index) =>
      rule.variant === 'inline-reminder'
        && (index === 0 || !['ability', 'keyword'].includes(this.rules[index - 1].variant)))
    ) {
      throw new Error('if there is inline-reminder text, it must always be after an ability or keyword in the rules');
    }
    // if there is flavor text, it must always be at the end
    if (this.rules.some((rule, index) => rule.variant === 'flavor' && index !== this.rules.length - 1)) {
      throw new Error('if there is flavor text, it must always be at the end of the rules');
    }
    // the card name should not be in the rules (use ~ as a placeholder for the card name)
    if (this.rules.some(rule => rule.content.toLowerCase().includes(this.name.toLowerCase()))) {
      throw new Error('the card name should not be in the rules (use ~ as a placeholder for the card name)');
    }
    // ensure all keywords are lowercase
    if (this.rules.some(rule => rule.variant === 'keyword' && rule.content !== rule.content.toLowerCase())) {
      throw new Error('all keywords must be lowercase');
    }
    // ensure roles don't have newlines
    if (this.rules.some(rule => rule.variant === 'ability' && rule.content.includes('\n'))) {
      throw new Error('abilities must not contain newlines');
    }

    // Check toughness and power consistency
    if (this.pt) {
      // Check for integer values
      if (!Number.isInteger(this.pt.power) || !Number.isInteger(this.pt.toughness)) {
        throw new Error('power and toughness must be integers');
      }
      // Check for negative values
      if (this.pt.power < 0 || this.pt.toughness < 0) {
        throw new Error('power and toughness must be non-negative');
      }
    } else {
      // If there is no power and toughness, ensure the card is not a creature or vehicle artifact
      if (this.types.includes('creature')) {
        throw new Error('creature cards must have power and toughness');
      }
      if (this.types.includes('artifact') && this.subtypes.includes('vehicle')) {
        throw new Error('vehicle artifacts must have power and toughness');
      }
    }

    // Validate that land cards do not have a mana cost
    if (this.types.includes('land') && Object.keys(this.manaCost).length > 0) {
      throw new Error('land cards cannot have a mana cost');
    }

    // Validate planeswalkers
    if (this.types.includes('planeswalker')) {
      if (this.supertype !== 'legendary') {
        throw new Error('planeswalker cards must be legendary');
      }
      if (this.pt) {
        throw new Error('planeswalker cards cannot have power and toughness');
      }
      if (!this.loyalty) {
        throw new Error('planeswalker cards must have loyalty');
      }
      if (this.loyalty < 1) {
        throw new Error('planeswalker loyalty must be at least 1');
      }
      if (!Number.isInteger(this.loyalty)) {
        throw new Error('planeswalker loyalty must be an integer');
      }
      // Ensure has one subtype, which is the name of the planeswalker before the comma
      if (this.subtypes.length !== 0) {
        throw new Error('planeswalker cards cannot have subtypes, the planeswalker\'s name subtype will be added automatically');
      }
      if (!this.name.includes(',')) {
        throw new Error('planeswalker cards must have a comma in their name to separate the name from the title');
      }

      const loyaltyAbilityCosts: number[] = [];
      for (const rule of this.rules) {
        // Ensure it has only keywords and abilities
        if (!['keyword', 'ability', 'inline-reminder'].includes(rule.variant)) {
          throw new Error('planeswalker rules must only contain keywords and abilities');
        }

        // Ensure all loyalty are at the end and together
        const loyaltyAbility = tryParseLoyaltyAbility(rule);
        if (loyaltyAbility.success) {
          const cost = loyaltyAbility.cost;
          loyaltyAbilityCosts.push(cost === '-X' ? -9999 : cost);
        }
        if (!loyaltyAbility.success && loyaltyAbilityCosts.length > 0) {
          throw new Error('planeswalker loyalty abilities should all be together at the end');
        }
      }
      if (loyaltyAbilityCosts.length === 0) {
        throw new Error('planeswalker cards must have at least one loyalty ability');
      }
      if (loyaltyAbilityCosts.length > 3) {
        throw new Error('planeswalker cards cannot have more than three loyalty abilities');
      }
      // Ensure loyalty abilities are in descending order
      for (let i = 1; i < loyaltyAbilityCosts.length; i++) {
        if (loyaltyAbilityCosts[i] > loyaltyAbilityCosts[i - 1]) {
          throw new Error('planeswalker loyalty abilities must be in descending order');
        }
      }
    } else {
      // If not a planeswalker, ensure loyalty is not set
      if (this.loyalty) {
        throw new Error('only planeswalker cards can have loyalty');
      }
    }
  }

  public manaValue(): number {
    return Object
      .entries(this.manaCost)
      .reduce((sum, [t, amount]) => sum + (t === 'x' ? 0 : amount), 0);
  }

  public renderManaCost(): string {
    if (this.manaValue() === 0) {
      const hiddenManaCost = this.types.includes('land') || this.supertype === 'token';
      return hiddenManaCost ? '' : '{0}';
    }
    let result = '';
    if (this.manaCost['x'] !== undefined && this.manaCost['x'] > 0) {
      result += '{x}'.repeat(this.manaCost['x']);
    }
    if (this.manaCost['colorless'] !== undefined && this.manaCost['colorless'] > 0) {
      result += '{' + this.manaCost['colorless'] + '}';
    }
    const colors = toOrderedColors(Object.keys(this.manaCost).filter(c => !['colorless', 'x'].includes(c)) as CardColor[]);
    for (const color of colors) {
      const amount = this.manaCost[color];
      if (amount !== undefined && amount > 0) {
        result += `{${wubrg[cardColors.indexOf(color)]}}`.repeat(amount);
      }
    }
    return result;
  }

  public renderTypeLine(): string {
    let typeLine = '';
    if (this.supertype) {
      typeLine += capitalize(this.supertype) + ' ';
    }
    typeLine += this.types.map(t => capitalize(t)).join(' ');
    if (this.subtypes.length > 0) {
      typeLine += ' — ' + this.subtypes.map(st => capitalize(st)).join(' ');
    }
    if (this.types.includes('planeswalker')) {
      typeLine += ` — ${this.name.split(',')[0].trim()}`;
    }
    return typeLine;
  }

  public renderRules(): string {
    let text = '';
    for (let index = 0; index < this.rules.length; index++) {
      const rule: Rule = this.rules[index];
      if (this.types.includes('planeswalker') && tryParseLoyaltyAbility(rule).success) {
        // Skip the loyalty abilities of planeswalkers, they are rendered separately in the loyalty box
        continue;
      }

      const peekNext = (n = 1) => {
        if (index + n < this.rules.length) {
          return this.rules[index + n];
        } else {
          return undefined;
        }
      };
      const checkLineEnding = () => {
        const next = peekNext();
        if (next && next.variant === 'inline-reminder') {
          text += ' ';
        } else if (next && next.variant !== 'flavor') {
          text += '\n';
        }
      };
      let nextRule: Rule | undefined, nextRule2: Rule | undefined;
      switch (rule.variant) {
      case 'reminder':
      case 'inline-reminder':
        text += `{i}(${rule.content}){/i}`;
        checkLineEnding();
        break;
      case 'keyword':
        text += capitalize(rule.content);
        nextRule = peekNext();
        nextRule2 = peekNext(2);
        while (nextRule && nextRule.variant === 'keyword' && (nextRule2 === undefined || nextRule2.variant !== 'inline-reminder')) {
          text += `, ${nextRule.content}`;
          index += 1;
          nextRule = peekNext();
          nextRule2 = peekNext(2);
        }
        checkLineEnding();
        break;
      case 'ability':
        text += rule.content;
        checkLineEnding();
        break;
      case 'flavor':
        text += `{flavor}${rule.content}`;
      }
    }
    const shortCardName = this.name.includes(',') ? this.name.split(',')[0].trim() : this.name;
    return text.replace(/~/g, shortCardName).replace(/ +/g, ' ').trim();
  }

  public loyaltyAbilities(): { cost: LoyaltyCost, content: string }[] {
    if (!this.types.includes('planeswalker')) {
      return [];
    }
    const abilities: { cost: LoyaltyCost, content: string }[] = [];
    for (const rule of this.rules) {
      const ability = tryParseLoyaltyAbility(rule);
      if (ability.success) {
        abilities.push({ cost: ability.cost, content: ability.content });
      }
    }
    return abilities;
  }

  public color(): CardColor[] {
    if (this.supertype === 'token') {
      return toOrderedColors(this.tokenColors ?? []);
    }
    return Card.colorOf(this.renderManaCost());
  }

  public colorIdentity(): CardColor[] {
    if (this.supertype === 'token') {
      return toOrderedColors(this.tokenColors ?? []);
    }
    const context = this.renderManaCost() + ' ' + this.rules
      .filter(v => ['keyword', 'ability'].includes(v.variant))
      .map(rule => rule.content)
      .join(' ');

    return Card.colorOf(context);
  }

  private static colorOf = (context: string) => {
    const colorRegex = /{([\w/]+)}/g;
    const matches = context.matchAll(colorRegex);
    const result = new Set<CardColor>();
    for (const match of matches) {
      const inner = match[1];
      for (let i = 0; i < wubrg.length; i++) {
        if (inner.includes(wubrg[i])) {
          result.add(cardColors[i]);
        }
      }
    }
    return toOrderedColors([...result]);
  }

  public toJson(): SerializedCard {
    return structuredClone({
      id: this.id,
      name: this.name,
      rarity: this.rarity,
      supertype: this.supertype,
      tokenColors: this.tokenColors,
      types: this.types,
      subtypes: this.subtypes,
      manaCost: this.manaCost,
      rules: this.rules,
      pt: this.pt,
      loyalty: this.loyalty,
      collectorNumber: this.collectorNumber,
      art: this.art,
      tags: this.tags,
    });
  }

  getReferenceName(): string {
    let referenceName = '';
    if (this.supertype === 'basic' || this.supertype === 'legendary') {
      referenceName += `${this.supertype} `;
    }
    if (this.pt) {
      referenceName += `${this.pt.power}/${this.pt.toughness} `;
    }
    const color = this.color();
    if (color.length > 0) {
      referenceName += `${color.join(' and ')} `;
    } else if (!this.types.includes('artifact')) {
      referenceName += 'colorless ';
    }
    if (this.subtypes.length > 0) {
      referenceName += `${this.subtypes.map(capitalize).join(' ')} `;
    }
    referenceName += this.types.join(' ');
    if (this.supertype === 'token') {
      referenceName += ' token';
    }
    return referenceName;
  }

  public explain(props?: { withoutName?: boolean }): string {
    let readable = props?.withoutName ? '' : `"${this.name}" (#${this.collectorNumber}) is `;
    readable += `a ${this.rarity} `;
    readable += this.getReferenceName();
    if (this.manaValue() > 0) {
      readable += ` for ${this.renderManaCost()} mana`;
    }
    if (this.loyalty !== undefined) {
      readable += ` with ${this.loyalty} starting loyalty`;
    }
    const keywordsAndAbilities = this.rules.filter(r => r.variant === 'ability' || r.variant === 'keyword');
    if (keywordsAndAbilities.length > 0) {
      readable += `, with: ${keywordsAndAbilities.map((r, i) => {
        if (i === 0) {
          return `"${r.content}"`;
        }
        const isKeyword = r.variant === 'keyword';
        const isPreviousKeyword = keywordsAndAbilities[i - 1].variant === 'keyword';
        const hasAnd = !isKeyword || !isPreviousKeyword;
        return `${hasAnd ? ' and ' : ', '}"${r.content}"`;
      }).join('')}`;
    }
    readable += '.';
    return readable;
  }

  getCreatableTokenNames(): string[] {
    return this.rules
      .filter(r => r.variant === 'ability' && r.content.toLowerCase().includes('create'))
      .flatMap(r => {
        const tokenRegex = /create (?:a|X|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen) ([a-zA-Z0-9/\s]+? token)s?/gi;
        const match = r.content.matchAll(tokenRegex);
        return Array.from(match).map(m => m[1].trim());
      })
      .filter(token => token.length > 0);
  }

  /**
   * Get a tag value as a string.
   *
   * @param tagName the name of the tag to get
   * @param options additional options
   *                - if stringify is true, non-string values will be converted to strings
   *
   * @return the tag value as a string, or undefined if the tag does not exist or is not a string
   */
  getTagAsString(tagName: string, options?: {
    stringify?: boolean,
  }): string | undefined {
    const tagValue = this.tags[tagName];
    if (tagValue === undefined) {
      return undefined;
    }
    if (typeof tagValue === 'string') {
      return tagValue;
    }
    const stringify = options?.stringify ?? false;
    if (!stringify) {
      return undefined;
    }
    return typeof tagValue === 'boolean' ? (tagValue ? 'true' : 'false') : tagValue.toString();
  }

  /**
   * Get a tag value as a number.
   *
   * @param tagName the name of the tag to get
   * @param options additional options
   *                - if parseFromUndefined is true, undefined values will be parsed as 0
   *                - if parseFromString is true, string values will be parsed as numbers
   *                - if parseFromBoolean is true, boolean values will be parsed as 1 for true and 0 for false
   *
   * @return the tag value as a number, or undefined if the tag does not exist or cannot be parsed
   */
  getTagAsNumber(tagName: string, options?: {
    parseFromUndefined?: boolean,
    parseFromString?: boolean,
    parseFromBoolean?: boolean,
  }): number | undefined {
    const tagValue = this.tags[tagName];
    if (tagValue === undefined) {
      if (options?.parseFromUndefined) {
        return 0;
      }
      return undefined;
    }
    if (typeof tagValue === 'number') {
      return tagValue;
    }
    if (options?.parseFromString && typeof tagValue === 'string') {
      const parsed = parseFloat(tagValue);
      return isNaN(parsed) ? undefined : parsed;
    }
    if (options?.parseFromBoolean && typeof tagValue === 'boolean') {
      return tagValue ? 1 : 0;
    }
    return undefined;
  }
}
