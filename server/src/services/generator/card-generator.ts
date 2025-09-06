import { AISampleGenerator } from './ai-sample-generator';
import { Card, SerializedCardSchema } from 'kindred-paths';
import { Anthropic } from '@anthropic-ai/sdk';

export class CardGenerator extends AISampleGenerator<Card> {
  constructor(
    anthropic: Anthropic,
    prompt: string,
  ) {
    const systemPrompt = `You are tasked with generating valid JSON objects that conform to the SerializedCardSchema for Magic: The Gathering cards.

Schema definition:
${JSON.stringify(SerializedCardSchema.shape, null, 2)}

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
  ],
  "collectorNumber": 125
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
  },
  "collectorNumber": 42
}

{
  "id": "mtg_003",
  "name": "Jace, the Mind Sculptor",
  "rarity": "mythic",
  "supertype": "legendary",
  "types": ["planeswalker"],
  "subtypes" [], // Subtypes for planeswalkers must be empty
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
  "loyalty": 3,
  "collectorNumber": 81
}`;

    super({
      anthropic,
      systemPrompt,
      userPrompt: prompt,
      transformer: (text: string) => {
        const jsonObject = JSON.parse(text);
        const validatedData = SerializedCardSchema.parse(jsonObject);
        return new Card(validatedData);
      },
      summarizer: (card: Card) => card.explain(),
    });
  };
}
