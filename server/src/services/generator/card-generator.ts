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
    const systemPrompt = `You are tasked with generating valid JSON objects that conform to the SerializedCardSchema for Magic: The Gathering cards.

Schema definition:
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
  "manaCost": {"white": 3, "colorless": 2},
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
  "manaCost": {"blue": 2, "colorless": 2},
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
}`;

    super({
      anthropic,
      systemPrompt,
      userPrompt: prompt,
      transformer: (text: string) => {
        const jsonObject = JSON.parse(text);
        const validatedData = GenerateCardSchema.parse(jsonObject);
        return new Card({ ...validatedData, id: `ai-${crypto.randomUUID()}`, collectorNumber: 1, tags: { count: 1 } });
      },
      summarizer: (card: Card) => card.explain(),
      statistics: (samples: Card[]) => {
        const {
          totalCount, nonlandCount, landCount,
          cardColorDistribution, cardTypeDistribution,
          manaValueDistribution, rarityDistribution,
          manaValueRarityDistribution, subtypeDistribution
        } = getStatistics(samples);
        return JSON.stringify({
          totalCount, nonlandCount, landCount,
          cardColorDistribution, cardTypeDistribution,
          manaValueDistribution, rarityDistribution,
          manaValueRarityDistribution, subtypeDistribution
        }, undefined, 2);
      },
      immediatelyAfterGenerateHook: sample => {
        // Create a preview render in parallel, to ensure the card can be shown quickly
        // noinspection JSIgnoredPromiseFromCall
        renderService.generatePreview(sample.toJson()).catch(e => console.error('Skip render of ai generated card, because of error:', e));
      }
    });
  };
}
