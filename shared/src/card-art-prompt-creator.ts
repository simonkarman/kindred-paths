/* eslint-disable max-len */
import { Card, landSubtypeToColor } from './card';

const fixSpacing = (text: string): string => {
  return text
    .replace(/\s+/g, ' ') // Replace multiple instances of whitespace with a single space
    .trim(); // Trim leading and trailing spaces
};

export class CardArtPromptCreator {
  constructor() {}

  createPrompt(card: Card): string {
    const sections: string[] = [];

    // Add introduction section
    const dominantCardType = card.types[card.types.length - 1];
    sections.push(`A Magic the Gathering artwork for a ${dominantCardType} named "${card.name}"`);

    // Style section
    const focus: { [cardType: string]: string } = {
      'creature': ', focusing on a dynamic moment that tells a clear story within a single frame',
      'artifact': ', focusing on a close up of the artifact as the main subject',
      'sorcery': ', focusing on an event taking place',
      'instant': ', focusing on an action being performed',
      'land': ', focusing on an empty landscape or environment',
      'enchantment': ', focusing on a magical effect that is visible in the environment',
      'planeswalker': ', focusing on a dynamic moment that tells a clear story within a single frame',
    };
    if (card.tags['set'] === 'miffy') {
      const miffyStyle = `in the style of Miffy by Dick Bruna using simple colors and without shadows${focus[dominantCardType] ?? ''}.`;
      sections.push(miffyStyle);
    } else {
      const magicStyle = `in the style of Magic: The Gathering artists like Johannes Voss, Chris Rahn, or Magali Villeneuve${focus[dominantCardType] ?? ''}.`;
      sections.push(magicStyle);
    }

    // Add main subject section when the card is not a land
    if (dominantCardType !== 'land') {
      sections.push('The main subject takes up about 60% of the composition.');
    }

    // Add card type section
    sections.push(this[`${dominantCardType}Prompt`](card));

    // Add tags["setting"] section
    const setting = card.tags['setting'];
    if (typeof setting === 'string' && setting.length > 0) {
      sections.push(setting);
    }

    return sections.filter(s => s.length > 0).join(' ');
  }

  private creaturePrompt(card: Card): string {
    const power = card.pt?.power ?? 0;
    const toughness = card.pt?.toughness ?? 0;

    const powerDescription = {
      0: 'non-combatant',
      1: toughness > 1 ? 'weak' : '',
      2: '',
      3: '',
      4: 'strength',
    }[power] ?? 'powerful';

    const creatureTypeDescription = {
      0: 'creature',
      1: `${card.subtypes[0]} creature`,
      2: `${card.subtypes[0]} creature with ${card.subtypes[1]} features`,
    }[card.subtypes.length] || `${card.subtypes[0]} creature with features from ${card.subtypes.slice(1, -1).join(', ')} and ${card.subtypes[card.subtypes.length - 1]}`;

    const toughnessDescription = {
      0: 'nimble-sized',
      1: 'nimble-sized in an agile pose',
      2: 'small-sized in a dynamic pose',
      3: 'medium-sized with balanced proportions',
      4: 'medium-sized with a robust build',
      5: 'large-sized with a powerful stance',
      6: 'large-sized with overwhelming presence',
    }[toughness] || 'massive towering creature with an overwhelming presence';

    const singleKeywordDescriptions: { [keyword: string]: string } = {
      'flying': 'is flying',
      'trample': 'shows unstoppable force',
      'haste': 'is charging forward',
      'first strike': 'is ready to strike first in combat',
      'vigilance': 'is standing alert and ready for action',
      'reach': 'has a feature that allows it to reach (or strike targets) in the sky',
    };
    const keywordDescriptions = card.rules
      .filter(r => r.variant === 'keyword' && r.content in singleKeywordDescriptions)
      .map(r => singleKeywordDescriptions[r.content]);
    const keywordDescription = keywordDescriptions.length > 0 ? `which ${keywordDescriptions.join(' and ')}` : '';

    const rarityDescription = {
      'common': 'simple appearance with common and standard clothing',
      'uncommon': 'simple appearance with common and standard clothing',
      'rare': 'intricate appearance with unique and rare clothing',
      'mythic': 'mythical appearance with awe-inspiring presence and clothing made with incredible craftsmanship',
    }[card.rarity];

    const color = card.color();
    const colorDescription = color.length > 0 ? color.join(' and ') : 'gray and brown';

    return fixSpacing(
      `Depicting a ${card.supertype ?? ''} ${powerDescription} ${creatureTypeDescription} `
      + `that is a ${toughnessDescription} ${keywordDescription} use a ${rarityDescription} and focus on ${colorDescription} colors.`,
    );
  }

  private artifactPrompt(card: Card): string {
    const rarityDescription = {
      'common': 'steel look with common and standard shapes',
      'uncommon': 'metallic look with common shapes',
      'rare': 'golden look of high quality made with precious materials',
      'mythic': 'unique glowing look of incredible craftsmanship made with elaborate details and mythical materials',
    }[card.rarity];

    const color = card.colorIdentity();
    const colorDescription = color.length > 0 ? color.join(' and ') : 'gray and brown';

    return `${card.name} is a small item, that is shown in a fitting environment. It has a ${rarityDescription} and the item has ${colorDescription} colors.`;
  }

  private enchantmentPrompt(card: Card): string {
    const isAura = card.subtypes.includes('aura');
    return `Showing ${card.name} as a ${card.color().join(' and ')} magical effect ${isAura ? 'on a creature.' : 'that is visible in the environment.'}`;
  }

  private instantPrompt(card: Card): string {
    return '';
  }

  private landPrompt(card: Card): string {
    const identityColors = card.colorIdentity();
    const landTypeColors = card.subtypes.map(st => landSubtypeToColor(st)).filter(c => c !== undefined);
    const colors = Array.from(new Set([...identityColors, ...landTypeColors]));

    const subtypeDescription = card.subtypes.length > 0 ? `is a ${card.subtypes.join(' and ')} and ` : '';

    const landDescriptions = {
      white: 'vast open plains, rolling grasslands, serene horizon',
      blue: 'mystical island, flowing water, coastal beauty',
      black: 'dark swampland, murky waters, twisted vegetation',
      red: 'rugged mountain terrain, rocky peaks, volcanic elements',
      green: 'lush forest landscape, ancient trees, verdant foliage',
    };
    const landDescription = colors.map(c => landDescriptions[c]).join(' and ');

    return fixSpacing(
      `${card.name} ${subtypeDescription} is a ${landDescription}.`,
    );
  }

  private sorceryPrompt(card: Card): string {
    return '';
  }

  private planeswalkerPrompt(card: Card): string {
    return '';
  }
}
