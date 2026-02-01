import { TokenExtractor } from './token-extracter';
import { CardColor, cardColors, Mana, toOrderedColors, wubrg } from './colors';
import { SerializedCardFace } from './serialized-card-face';
import { capitalize, enumerate } from './typography';
import {
  Card,
} from './card';

export type CardSuperType = undefined | 'basic' | 'legendary';
export const cardSuperTypes = [undefined, 'basic', 'legendary'] as const;

export type CardType = 'enchantment' | 'artifact' | 'instant' | 'sorcery' | 'creature' | 'land' | 'planeswalker';
export const cardTypes = ['enchantment', 'artifact', 'creature', 'land', 'instant', 'sorcery', 'planeswalker'] as const;
export const permanentTypes = ['enchantment', 'artifact', 'creature', 'land', 'planeswalker'] as const;

export type TokenCardType = Exclude<CardType, 'instant' | 'sorcery' | 'planeswalker'>;
export const tokenCardTypes = ['enchantment', 'artifact', 'creature', 'land'] as const;
export const predefinedTokenNames = ['Blood', 'Clue', 'Food', 'Fuel', 'Gold', 'Incubator', 'Junk', 'Map', 'Powerstone', 'Treasure', 'Asteroid'];

export type Pt = { power: number | '*', toughness: number | '*' };

export const landSubtypes = ['plains', 'island', 'swamp', 'mountain', 'forest'] as const;
export const landSubtypeToColor = (type: typeof landSubtypes[number] | string): CardColor | undefined => ({
  plains: 'white',
  island: 'blue',
  swamp: 'black',
  mountain: 'red',
  forest: 'green',
}[type] as CardColor | undefined);

export const ruleVariants = ['card-type-reminder', 'keyword', 'ability', 'inline-reminder', 'flavor'] as const;
export type RuleVariant = 'card-type-reminder' | 'keyword' | 'ability' | 'inline-reminder' | 'flavor';
export type Rule = { variant: RuleVariant, content: string };
export type LoyaltyCost = number | '-X';
export const loyaltyCostAsString = (loyalty: LoyaltyCost): string => {
  if (typeof loyalty === 'string') {
    return loyalty;
  }
  if (loyalty > 0) {
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

const tokenExtractor = new TokenExtractor();

export class CardFace {
  public readonly card: Card;
  public readonly faceIndex: number;

  public readonly name: string;
  public readonly givenColors?: CardColor[];
  public readonly manaCost?: { [type in Mana]?: number };
  public readonly types: [CardType, ...CardType[]];
  public readonly subtypes: string[];
  public readonly supertype: CardSuperType;
  public readonly rules: Rule[];
  public readonly pt?: Pt;
  public readonly loyalty?: number;
  public readonly art?: string;

  constructor(props: SerializedCardFace, card: Card, faceIndex: number) {
    this.card = card;
    this.faceIndex = faceIndex;

    this.name = props.name;
    this.givenColors = props.givenColors;
    this.manaCost = props.manaCost;
    this.types = props.types;
    this.subtypes = props.subtypes ?? [];
    this.supertype = props.supertype;
    this.rules = props.rules ?? [];
    this.pt = props.pt;
    this.loyalty = props.loyalty;
    this.art = props.art;
  }

  public toJson(): SerializedCardFace {
    return structuredClone({
      name: this.name,
      givenColors: this.givenColors,
      manaCost: this.manaCost,
      types: this.types,
      subtypes: this.subtypes,
      supertype: this.supertype,
      rules: this.rules,
      pt: this.pt,
      loyalty: this.loyalty,
      art: this.art,
    });
  }

  public validate() {
    // Check basic superType consistency
    if (this.supertype === 'basic') {
      if (!this.types.includes('land')) {
        throw new Error('super type basic must be associated with lands');
      }
      if (this.card.rarity !== 'common') {
        throw new Error('super type basic must have common rarity');
      }
      if (this.card.isToken) {
        throw new Error('super type basic cannot be a token');
      }
      if (this.card.faces.length !== 1) {
        throw new Error('basic land cards can only have one face');
      }
    }

    // Check token superType consistency
    if (this.card.isToken) {
      if (this.card.rarity !== 'common') {
        throw new Error('super type token must have common rarity');
      }
      if (this.card.faces.length !== 1) {
        throw new Error('token cards can only have one face');
      }
      if (!tokenCardTypes.some(pct => this.types.includes(pct))) {
        throw new Error(`super type token must be associated with a tokenable type (${tokenCardTypes.join(', ')})`);
      }
      if (this.manaCost !== undefined) {
        throw new Error('token cards cannot have a mana cost');
      }
      if (this.rules.some(rule => rule.content.includes('~'))) {
        throw new Error('a token cannot reference itself, please use this creature/this artifact/etc. instead of ~ in the rules');
      }
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
      const isAdventureFace = this.faceIndex === 1
        && this.card.layout.id === 'adventure'
        && this.types.length === 1
        && this.subtypes[0] === 'adventure';
      if (!isAdventureFace) {
        throw new Error('instants and sorceries cannot have subtypes');
      }
    }

    // Validate rules
    // Check that only normal single quotes and double quotes are used
    if (this.rules.some(rule => /[“”‘’]/.test(rule.content))) {
      throw new Error('only normal single quotes (\') and double quotes (") are allowed in rules');
    }
    // if there is reminder text, it must always be first
    if (this.rules.some((rule, index) => index !== 0 && rule.variant === 'card-type-reminder')) {
      throw new Error('if there is card-type-reminder text, it must always be first in the rules');
    }
    // if there is inline-reminder text, it must always be after an ability or keyword
    if (this.rules.some((rule, index) =>
      rule.variant === 'inline-reminder'
      && (index === 0 || !['ability', 'keyword'].includes(this.rules[index - 1].variant)))
    ) {
      throw new Error('if there is inline-reminder text, it must always be after an ability or keyword in the rules');
    }
    // card-type-reminders and inline-reminders should not start with ( or end with )
    if (this.rules.some(rule =>
      (rule.variant === 'card-type-reminder' || rule.variant === 'inline-reminder')
      && (rule.content.startsWith('(') || rule.content.endsWith(')')))
    ) {
      throw new Error('reminder text should not start with ( or end with )');
    }
    // if there is flavor text, it must always be at the end
    if (this.rules.some((rule, index) => rule.variant === 'flavor' && index !== this.rules.length - 1)) {
      throw new Error('if there is flavor text, it must always be at the end of the rules');
    }
    // the card name should not be in the rules (use ~ as a placeholder for the card name)
    if (this.rules.some(rule => rule.content.toLowerCase().includes(this.name.toLowerCase()))) {
      throw new Error('the card name should not be in the rules (use ~ as a placeholder for the card name)');
    }
    // The emdash (—) should not be used in the rules, use {-} instead.
    if (this.rules.some(rule => rule.content.includes('—'))) {
      throw new Error('the card should not use the emdash (—) in the rules, use {-} (including the brackets) instead');
    }
    // The bullet (· or •) should not be used in the rules, use {bullet} instead.
    if (this.rules.some(rule => /[·•]/.test(rule.content))) {
      throw new Error('the card should not use the bullet (· or •) in the rules, use {bullet} instead');
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
      if ((this.pt.power !== '*' && !Number.isInteger(this.pt.power))
          || (this.pt.toughness !== '*' && !Number.isInteger(this.pt.toughness))
      ) {
        throw new Error('power and toughness must be integers');
      }
      // Check for negative values
      if ((typeof this.pt.power !== 'string' && this.pt.power < 0) || (typeof this.pt.toughness !== 'string' && this.pt.toughness < 0)) {
        throw new Error('power and toughness must be non-negative');
      }
      // Check for rules containing "power" when power is '*'
      if (this.pt.power === '*' && !this.rules.some(rule => rule.content.toLowerCase().includes('power'))) {
        throw new Error('cards with * power must have rules that reference power');
      }
      // Check for rules containing "toughness" when toughness is '*'
      if (this.pt.toughness === '*' && !this.rules.some(rule => rule.content.toLowerCase().includes('toughness'))) {
        throw new Error('cards with * toughness must have rules that reference toughness');
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
    if (this.types.includes('land') && this.manaCost !== undefined) {
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
        if (rule.variant !== 'inline-reminder' && !loyaltyAbility.success && loyaltyAbilityCosts.length > 0) {
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

    // If there is no mana cost, ensure the card is a land or a token card or the back face of a transform card
    const allowNoManaCost = this.types.includes('land') || this.card.isToken || (this.card.layout.id === 'transform' && this.faceIndex === 1);
    if (!this.manaCost && !allowNoManaCost) {
      throw new Error('only land cards, token cards, and back faces of transform cards can have no mana cost');
    }

    // Check given colors consistency
    const allowNoGivenColors = this.types.includes('land');
    if (this.manaCost === undefined && this.givenColors === undefined && !allowNoGivenColors) {
      throw new Error('given colors must be provided if there is no mana cost');
    }
    if (this.manaCost !== undefined && this.givenColors !== undefined) {
      throw new Error('given colors cannot be provided if there is a mana cost');
    }
  }

  public manaValue(): number {
    if (!this.manaCost) {
      return 0;
    }

    return Object
      .entries(this.manaCost)
      .reduce((sum, [t, amount]) => sum + (t === 'x' ? 0 : amount), 0);
  }

  public renderManaCost(): string {
    if (!this.manaCost) {
      return '';
    }
    if (this.manaValue() === 0) {
      return '{0}';
    }
    let result = '';
    if (this.manaCost['x'] !== undefined && this.manaCost['x'] > 0) {
      result += '{x}'.repeat(this.manaCost['x']);
    }
    if (this.manaCost['generic'] !== undefined && this.manaCost['generic'] > 0) {
      result += '{' + this.manaCost['generic'] + '}';
    }
    if (this.manaCost['colorless'] !== undefined && this.manaCost['colorless'] > 0) {
      result += '{c}'.repeat(this.manaCost['colorless']);
    }
    const colors = toOrderedColors(Object.keys(this.manaCost).filter(c => !['generic', 'colorless', 'x'].includes(c)) as CardColor[]);
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
    if (this.card.isToken) {
      typeLine += 'Token ';
    }
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
        break;
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
      case 'card-type-reminder':
      case 'inline-reminder':
        if (rule.content.endsWith('{lns}')) {
          text += `{i}(${rule.content.substring(0, rule.content.length - 5)}){lns}{/i}\n\n`;
        } else {
          text += `{i}(${rule.content}){/i}`;
        }
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
    return this.sanitize(text);
  }

  public loyaltyAbilities(): { cost: LoyaltyCost, content: string }[] {
    if (!this.types.includes('planeswalker')) {
      return [];
    }
    const abilities: { cost: LoyaltyCost, content: string }[] = [];
    for (let ruleIndex = 0; ruleIndex < this.rules.length; ruleIndex++) {
      const rule = this.rules[ruleIndex];
      const ability = tryParseLoyaltyAbility(rule);
      if (ability.success) {
        const nextRule = this.rules[ruleIndex + 1];
        const postfix = nextRule?.variant === 'inline-reminder' ? ` {i}(${nextRule.content}){/i}` : '';
        const content = this.sanitize(ability.content + postfix);
        abilities.push({
          cost: ability.cost,
          content,
        });
      }
    }
    return abilities;
  }

  private sanitize(text: string) {
    const shortCardName = this.name.includes(',') ? this.name.split(',')[0].trim() : this.name;
    return text.replace(/~/g, shortCardName).replace(/ +/g, ' ').trim();
  }

  public color(): CardColor[] {
    if (this.manaCost === undefined) {
      return toOrderedColors(this.givenColors ?? []);
    }
    return CardFace.colorOf(this.renderManaCost());
  }

  public colorIdentity(): CardColor[] {
    if (this.manaCost === undefined) {
      return toOrderedColors(this.givenColors ?? []);
    }
    const context = this.renderManaCost() + ' ' + this.rules
      .filter(v => ['keyword', 'ability'].includes(v.variant))
      .map(rule => rule.content)
      .join(' ');

    return CardFace.colorOf(context);
  }

  public producibleColors(): (CardColor | 'colorless')[] {
    const context = this.rules
      .filter(v => ['keyword', 'ability', 'card-type-reminder'].includes(v.variant))
      .map(rule => rule.content)
      .join(' ');

    if (context.toLowerCase().includes('add one mana of any color')) {
      return [...cardColors];
    }

    const regex = /[Aa]dd ((?:{[wubrgc]+})+)( or ((?:{[wubrgc]+})+))?/g;
    const matches = context.matchAll(regex);
    const result = new Set<CardColor | 'colorless'>();
    for (const match of matches) {
      const first = match[1];
      const second = match[3];
      if (first.includes('{c}')) {
        result.add('colorless');
      }
      const firstColors = CardFace.colorOf(first);
      firstColors.forEach(c => result.add(c));
      if (second) {
        if (second.includes('{c}')) {
          result.add('colorless');
        }
        const secondColors = CardFace.colorOf(second);
        secondColors.forEach(c => result.add(c));
      }
    }

    if (this.types.includes('land')) {
      if (this.subtypes.includes('plains')) {
        result.add('white');
      }
      if (this.subtypes.includes('island')) {
        result.add('blue');
      }
      if (this.subtypes.includes('swamp')) {
        result.add('black');
      }
      if (this.subtypes.includes('mountain')) {
        result.add('red');
      }
      if (this.subtypes.includes('forest')) {
        result.add('green');
      }
    }
    return [...result];
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

  getReferenceName(): string {
    let referenceName = '';
    if (this.supertype) {
      referenceName += `${this.supertype} `;
    }
    if (this.pt) {
      referenceName += `${this.pt.power}/${this.pt.toughness} `;
    }
    const color = this.color();
    if (color.length > 0) {
      referenceName += `${enumerate(color)} `;
    } else if (!this.types.includes('artifact')) {
      referenceName += 'colorless ';
    }
    if (this.subtypes.length > 0) {
      referenceName += `${this.subtypes.map(capitalize).join(' ')} `;
    }
    referenceName += this.types.join(' ');
    if (this.card.isToken) {
      referenceName += ' token';
    }
    return referenceName;
  }

  getTokenReferenceName(): string {
    if (!this.card.isToken) {
      throw new Error('can only get token reference name for token cards');
    }

    if (predefinedTokenNames.some(predefinedTokenName => predefinedTokenName === this.name)) {
      return `${this.name} token`;
    }
    let referenceName = '';

    // If the name of the card is not the same as the subtypes joined, add it at the start
    const subtypesJoined = this.subtypes.join(' ');
    if (this.name.toLowerCase() !== subtypesJoined) {
      referenceName += `${this.name}, `;
    }

    // At the reference name
    referenceName += this.getReferenceName();

    // Add keywords and abilities in a way they're displayed on cards for token creation
    if (this.rules.length !== 0) {
      referenceName += ' with ' + this.rules.filter(r => ['keyword', 'ability'].includes(r.variant)).map(r => {
        if (r.variant === 'ability') {
          return `"${r.content}"`;
        }
        return r.content;
      }).join(' and ');
    }

    return referenceName;
  }

  public explain(props?: { withoutName?: boolean }): string {
    const faceInformation = this.card.layout.isDualRenderLayout()
      ? (this.faceIndex === 0 ? '/front' : '/back')
      : (this.faceIndex === 1 && this.card.layout.id !== 'normal') ? `/${this.card.layout.id}` : '';
    let readable = props?.withoutName ? '' : `"${this.name}" (#${this.card.collectorNumber}${faceInformation}) is `;
    readable += `a ${this.card.rarity} `;
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
    const tokens = new Set<string>();
    this.rules
      .filter(r => r.variant === 'ability' && r.content.toLowerCase().includes('create'))
      .forEach(r => {
        const extractedTokens = tokenExtractor.extractTokensFromAbility(r.content);
        extractedTokens.forEach(token => tokens.add(token));
      });

    return Array.from(tokens);
  }
}
