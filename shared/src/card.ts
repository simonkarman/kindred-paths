import { SerializedCard } from './serialized-card';

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export const cardRarities = ['common', 'uncommon', 'rare', 'mythic'] as const;

export type CardSuperType = undefined | 'basic' | 'token' | 'legendary';
export const cardSuperTypes = [undefined, 'basic', 'legendary'] as const;

export type CardType = 'enchantment' | 'artifact' | 'instant' | 'sorcery' | 'creature' | 'land';
export const cardTypes = ['enchantment', 'artifact', 'instant', 'sorcery', 'creature', 'land'] as const;

export type PermanentCardType = Exclude<CardType, 'instant' | 'sorcery'>;
export const permanentCardTypes = ['enchantment', 'artifact', 'creature', 'land'] as const;

export type CardColor = 'white' | 'blue' | 'black' | 'red' | 'green';
export type Mana = CardColor | 'colorless';
export const cardColors = ['white', 'blue', 'black', 'red', 'green'] as const;
export const wubrg = ['w', 'u', 'b', 'r', 'g'] as const;

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
    this.collectorNumber = props.collectorNumber;
    this.art = props.art;
    this.tags = props.tags ?? {};

    // Check basic superType consistency
    if (this.supertype === 'basic' && !this.types.includes('land')) {
      throw new Error('super type basic must be associated with lands');
    }
    if (this.supertype === 'basic' && this.rarity !== 'common') {
      throw new Error('super type basic must have common rarity');
    }
    if (this.supertype === 'token' && this.rarity !== 'common') {
      throw new Error('super type token must have common rarity');
    }
    if (this.supertype === 'token' && !permanentCardTypes.some(pct => this.types.includes(pct))) {
      throw new Error('super type token must be associated with a permanent type (enchantment, artifact, creature, land)');
    }
    if (this.supertype === 'token' && this.tokenColors === undefined) {
      throw new Error('super type token must have token colors defined');
    }
    if (this.tokenColors && this.supertype !== 'token') {
      throw new Error('token colors can only be defined for token cards');
    }
    if (this.supertype === 'token' && Object.keys(this.manaCost).length > 0) {
      throw new Error('token cards cannot have a mana cost');
    }

    // Check that card has at least one type
    if (this.types.length === 0) {
      throw new Error('card must have at least one type');
    }
    if (this.types.length > 1) {
      // If there are multiple types, make sure that land always comes last
      if (this.types.includes('land') && this.types[this.types.length - 1] !== 'land') {
        throw new Error('if there are multiple types, land must always come last');
      }

      // If there is a creature type, it must be last, unless land is last, then it must be second to last
      if (this.types.includes('creature')) {
        if (this.types[this.types.length - 1] !== 'creature' && (this.types[this.types.length - 1] !== 'land' || this.types[this.types.length - 2] !== 'creature')) {
          throw new Error('if there is a creature type, it must be last, unless land is last, then it must be second to last');
        }
      }

      // instance and sorcery cannot be combined with other types
      if (this.types.includes('instant') || this.types.includes('sorcery')) {
          throw new Error('instant and sorcery cannot be combined with other types');
      }
    }

    // Validate rules
    // if there is reminder text, it must always be first
    if (this.rules.some((rule, index) => index !== 0 && rule.variant === 'reminder')) {
      throw new Error('if there is reminder text, it must always be first in the rules');
    }
    // if there is inline-reminder text, it must always be after an ability or keyword
    if (this.rules.some((rule, index) => rule.variant === 'inline-reminder' && (index === 0 || !['ability', 'keyword'].includes(this.rules[index - 1].variant)))) {
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
    }

    // Check that if a card is a creature, it has power and toughness
    if (this.types.includes('creature') && !this.pt) {
      throw new Error('creature cards must have power and toughness');
    }
  }

  public manaValue(): number {
    return Object
      .entries(this.manaCost)
      .reduce((sum, [_, amount]) =>  sum + amount, 0);
  }

  public renderManaCost(): string {
    let result = '';
    if (this.manaCost['colorless'] !== undefined && this.manaCost['colorless'] > 0) {
      result += '{' + this.manaCost['colorless'] + '}';
    }
    for (const color of cardColors) {
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
    return typeLine;
  }

  public renderRules(): string {
    let text = "";
    for (let index = 0; index < this.rules.length; index++) {
      let rule: Rule = this.rules[index];
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
      }
      switch (rule.variant) {
        case 'reminder':
        case 'inline-reminder':
          text += `{i}(${rule.content}){/i}`;
          checkLineEnding();
          break;
        case 'keyword':
          text += capitalize(rule.content);
          let nextRule = peekNext();
          let nextRule2 = peekNext(2);
          while (nextRule && nextRule.variant === 'keyword' && (nextRule2 === undefined || nextRule2.variant !== 'inline-reminder')) {
            text += `, ${nextRule.content}`;
            index++;
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
    return text;
  }

  public color(): CardColor[] {
    if (this.supertype === 'token') {
      return this.tokenColors ?? [];
    }
    return this.colorOf(this.renderManaCost());
  }

  public colorIdentity(): CardColor[] {
    const context = this.renderManaCost() + ' ' + this.rules
      .filter(v => ['keyword', 'ability'].includes(v.variant))
      .map(rule => rule.content)
      .join(' ');

    return this.colorOf(context);
  }

  private colorOf = (context: string) => {
    const colorRegex = /{(\w+)}/g;
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
    return [...result];
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
      collectorNumber: this.collectorNumber,
      art: this.art,
      tags: this.tags,
    });
  }

  public explain(props?: { withoutName?: boolean }): string {
    let readable = props?.withoutName ? '' : `"${this.name}" (#${this.collectorNumber}) is `;
    readable += `a ${this.rarity} `
    if (this.supertype === 'basic' || this.supertype === 'legendary') {
      readable += `${this.supertype} `;
    }
    if (this.pt) {
      readable += `${this.pt.power}/${this.pt.toughness} `;
    }
    const color = this.color();
    if (color.length > 0) {
      readable += `${color.join(' and ')} `;
    } else {
      readable += `colorless `;
    }
    if (this.subtypes.length > 0) {
      readable += `${this.subtypes.join(' and ')} `;
    }
    readable += this.types.join(' ');
    if (this.supertype === 'token') {
      readable += ` token`;
    }
    if (this.manaValue() > 0) {
      readable += ` for ${this.renderManaCost()} mana`;
    }
    const keywordsAndAbilities = this.rules.filter(r => r.variant === 'ability' || r.variant === 'keyword');
    if (keywordsAndAbilities.length > 0) {
      readable += `, with: ${keywordsAndAbilities.map((r, i) => {
        const isKeyword = r.variant === 'keyword';
        const startingQuote = !isKeyword || keywordsAndAbilities[i - 1]?.variant !== 'keyword';
        const hasAnd = (i > 0 && startingQuote) || (keywordsAndAbilities[i + 1]?.variant !== 'keyword');
        return `${hasAnd ? " and " : ""}${(startingQuote || hasAnd) ? "" : ", "}"${r.content}"`;
      }).join('')}`;
    } else {
      readable += '.';
    }
    return readable;
  }

  hasToken() {
    return this.rules.some(r => r.variant === 'ability' && r.content.toLowerCase().includes('create'));
  }
}
