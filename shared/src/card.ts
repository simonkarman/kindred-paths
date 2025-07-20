import { SerializedCard } from './serialized-card';

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export const cardRarities = ['common', 'uncommon', 'rare', 'mythic'] as const;

export type CardSuperType = undefined | 'basic' | 'legendary';
export const cardSuperTypes = [undefined, 'basic', 'legendary'] as const;

export type CardType = 'enchantment' | 'artifact' | 'instant' | 'sorcery' | 'creature' | 'land';
export const cardTypes = ['enchantment', 'artifact', 'instant', 'sorcery', 'creature', 'land'] as const;

export type CardColor = 'white' | 'blue' | 'black' | 'red' | 'green';
export type Mana = CardColor | 'colorless';
export const cardColors = ['white', 'blue', 'black', 'red', 'green'] as const;
export const wubrg = ['w', 'u', 'b', 'r', 'g'] as const;

export type RuleVariant = 'reminder' | 'keyword' | 'ability' | 'inline-reminder' | 'flavor';
export type Rule = { variant: RuleVariant, content: string };

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export class Card {
  public readonly id: string;
  public readonly name: string;
  public readonly rarity: CardRarity;
  public readonly supertype: CardSuperType;
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
    // all indices of the keywords should be successive
    const keywordIndices = this.rules
      .map((rule, index) => rule.variant === 'keyword' ? index : -1)
      .filter(index => index !== -1);
    for (let i = 1; i < keywordIndices.length; i++) {
      if (keywordIndices[i] !== keywordIndices[i - 1] + 1) {
        throw new Error('all keywords should be together in the rules');
      }
    }
    // if there are multiple keywords, don't allow an inline-reminder after the last keyword
    if (keywordIndices.length > 1 && this.rules[keywordIndices[keywordIndices.length - 1] + 1]?.variant === 'inline-reminder') {
      throw new Error('if there are multiple keywords, do not allow an inline-reminder after the last keyword in the rules');
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
      const peekNext = () => {
        if (index + 1 < this.rules.length) {
          return this.rules[index + 1];
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
          while (nextRule && nextRule.variant === 'keyword') {
            text += `, ${nextRule.content}`;
            index++;
            nextRule = peekNext();
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

  public explain(): string {
    let readable = `"${this.name}" (#${this.collectorNumber}) is a ${this.rarity} `;
    if (this.supertype) {
      readable += `${this.supertype} `;
    }
    if (this.pt) {
      readable += `${this.pt.power}/${this.pt.toughness} `;
    }
    const color = this.color();
    if (color.length > 0) {
      readable += `${color.join(' and ')} `;
    }
    if (this.subtypes.length > 0) {
      readable += `${this.subtypes.join(' and ')} `;
    }
    readable += this.types.join(' ');
    if (this.manaValue() > 0) {
      readable += ` for ${this.renderManaCost()} mana`;
    }
    const keywordsAndAbilities = this.rules.filter(r => r.variant === 'ability' || r.variant === 'keyword');
    if (keywordsAndAbilities.length > 0) {
      readable += `, with: ${keywordsAndAbilities.map(r => `"${r.content}"`).join(' and ')}`;
    } else {
      readable += '.';
    }
    return readable;
  }
}
