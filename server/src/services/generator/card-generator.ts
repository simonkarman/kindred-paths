import { AISampleGenerator } from './ai-sample-generator';
import { Card, getStatistics } from 'kindred-paths';
import { Anthropic } from '@anthropic-ai/sdk';
import { GenerateCardSchema } from './generate-card-schema';
import { renderService } from '../render-service';

export class CardGenerator extends AISampleGenerator<Card> {
  constructor(
    anthropic: Anthropic,
    prompt: string,
  ) {
    const systemPrompt = `You are tasked with generating valid JSON objects that conform to the CardSchema for Magic: The Gathering cards.

Card Schema definition:
${JSON.stringify(GenerateCardSchema.shape, null, 2)}

Additional information:
- Do NOT add reminder text to cards.
- Ensure that planeswalkers have an empty subtypes array.
- Use "~" to represent the card's name in rules text.
- Power and toughness should be included for creatures and vehicle artifacts only.
- Loyalty should be included for planeswalkers only.

Example valid JSON objects:
{
  "id": "mtg_001",
  "name": "Lightning Bolt",
  "rarity": "common",
  "types": ["instant"],
  "manaCost": {"red": 1},
  "rules": [
    {
      "variant": "ability",
      "content": "~ deals 3 damage to any target."
    }
  ]
}

{
  "id": "mtg_002",
  "name": "Serra Angel",
  "rarity": "uncommon",
  "types": ["creature"],
  "subtypes": ["Angel"],
  "manaCost": {"white": 3, "generic": 2},
  "rules": [
    {
      "variant": "keyword",
      "content": "flying"
    },
    {
      "variant": "keyword",
      "content": "vigilance"
    }
  ],
  "pt": {
    "power": 4,
    "toughness": 4
  }
}

{
  "name": "Jace, the Mind Sculptor",
  "rarity": "mythic",
  "supertype": "legendary",
  "types": ["planeswalker"],
  "subtypes" [],
  "manaCost": {"blue": 2, "generic": 2},
  "rules": [
    {
      "variant": "ability",
      "content": "+2: Look at the top card of target player's library. You may put that card on the bottom of that player's library."
    },
    {
      "variant": "ability",
      "content": "0: Draw three cards, then put two cards from your hand on top of your library in any order."
    }
  ],
  "loyalty": 3
}

When generating the samples, ensure that at least the RULES are meaningfully different from all previous samples.
Other properties can be similar or changed too. But keep in mind the stick the the prompt of the user.
Please generate cards with rules that are DIFFERENT and UNIQUE from the above.
Avoid duplicating concepts, themes, or characteristics in the rules that have already been used.
These samples are variants of the same prompt so it is okay if some of the properties are similar, but the rules must be different.
You can use different mechanics, themes, or abilities to achieve this.

Make sure to align the mana cost and name with the rules you choose.`;

    super({
      anthropic,
      systemPrompt,
      userPrompt: prompt,
      transformer: (text: string) => {
        const jsonObject = JSON.parse(text);
        const validatedData = GenerateCardSchema.parse(jsonObject);
        return new Card({
          id: `ai-${crypto.randomUUID()}`,
          isToken: validatedData.isToken,
          collectorNumber: 1,
          tags: { count: 1 },
          rarity: validatedData.rarity,
          faces: [{
            name: validatedData.name,
            supertype: validatedData.supertype,
            types: validatedData.types,
            subtypes: validatedData.subtypes ?? [],
            givenColors: validatedData.givenColors,
            manaCost: validatedData.manaCost,
            rules: validatedData.rules ?? [],
            pt: validatedData.pt,
            loyalty: validatedData.loyalty,
          }],
        });
      },
      summarizer: (card: Card) => card.faces[0].explain(),
      statistics: (samples: Card[]) => {
        const {
          totalCount, nonlandCount, landCount,
          cardColorDistribution, cardTypeDistribution,
          manaValueDistribution, rarityDistribution,
          manaValueRarityDistribution, subtypeDistribution,
        } = getStatistics(samples);
        return JSON.stringify({
          totalCount, nonlandCount, landCount,
          cardColorDistribution, cardTypeDistribution,
          manaValueDistribution, rarityDistribution,
          manaValueRarityDistribution, subtypeDistribution,
        }, undefined, 2);
      },
      immediatelyAfterGenerateHook: sample => {
        // Create a preview render in parallel, to ensure the card can be shown quickly
        for (let faceIndex = 0; faceIndex < sample.faces.length; faceIndex++) {
          renderService.generatePreview(sample.toJson(), faceIndex)
            .catch(e => console.error('Skip render of ai generated card, because of error:', e));
        }
      },
    });
  };
}
