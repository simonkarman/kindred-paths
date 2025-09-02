import fs from 'fs/promises';
import { Card, CardArtPromptCreator, SerializedCard } from 'kindred-paths';
import { Anthropic } from '@anthropic-ai/sdk';
import { Leonardo } from "@leonardo-ai/sdk";
import { z } from 'zod';
import { GetGenerationByIdResponse } from '@leonardo-ai/sdk/sdk/models/operations';
import { computeCardId } from '../utils/card-utils';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface NameSuggestion {
  name: string;
  reason: string;
}

interface ArtSettingSuggestion {
  name: string;
  setting: string;
}

interface ArtSuggestion {
  fileName: string;
  base64Image: string;
}

export class AIService {
  private anthropic: Anthropic;
  private leonardo: Leonardo;
  private cardArtPromptCreator: CardArtPromptCreator;
  private artSuggestionDir = './art/suggestions';

  constructor() {
    this.anthropic = new Anthropic();
    this.leonardo = new Leonardo({
      bearerAuth: process.env.LEONARDO_API_KEY || '',
    });
    this.cardArtPromptCreator = new CardArtPromptCreator();
  }

  async getCardNameSuggestions(cardData: SerializedCard): Promise<NameSuggestion[]> {
    const card = new Card(cardData);

    const msg = await this.anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 1000,
      temperature: 1,
      system: "You're an expert in coming up with creative names for custom Magic the Gathering cards. " +
        "Always respond with a JSON array where each entry is a suggestion. " +
        "Generate name suggestions and return ONLY valid JSON without any markdown formatting or code blocks. " +
        "Return as an array of objects with \"name\" and \"reason\" properties. " +
        "Each suggestion is an object with two properties. " +
        "'name' - which is the name you suggest for the card. " +
        "'reason' - which is a short explanation of why you chose this name. " +
        "Please add 5-10 suggestions. Avoid using the same name twice. " +
        "Use different styles of names, it is okay if the users doesn't use one of the provided suggestion directly but picks from multiple suggestions. " +
        "For sorceries and instants try to use the name either as something that happened or describes what happens when the spell resolves." +
        "For creatures use names like 'Arabho, The Great', that have a given name and a title. " +
        "For noncreature permanents use names of places, objects, or concepts. That describe the context within what happens on the card could happen. " +
        "In general, use different styles and approaches to naming the cards.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Could you suggest some card names for ${card.explain({ withoutName: true })}`
            }
          ]
        }
      ]
    });

    const respondError = (reason: string): NameSuggestion[] => [{ name: "No name suggestions available", reason }];

    const message = msg.content.find(content => content.type === 'text')?.text;
    if (!message) {
      return respondError("No text was outputted by the AI model.");
    }

    try {
      return z.array(z.object({ name: z.string().min(1), reason: z.string().min(1) })).parse(JSON.parse(message));
    } catch (e) {
      return respondError("The response from the AI model was not valid JSON.");
    }
  }

  async getCardArtSettingSuggestions(cardData: SerializedCard): Promise<ArtSettingSuggestion[]> {
    const card = new Card(cardData);

    const msg = await this.anthropic.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 1000,
      temperature: 1,
      system: "You're an expert in coming up with creative art settings for custom Magic the Gathering cards based on a given card. " +
        "Always respond with a JSON array where each entry is a suggestion for an art setting. " +
        "An art setting describes what the card artist that will make the artwork for the card should create. " +
        "The art setting should describe the location, what happens on the foreground, and what happens on the background. " +
        "Generate art setting suggestions and return ONLY valid JSON without any markdown formatting or code blocks. " +
        "Return as an array art setting suggestions, which are objects with \"name\" and \"setting\" properties. " +
        "Each art setting suggestion is an object with two properties. " +
        "'name' - which is a title for the art setting. " +
        "'setting' - which is the short art setting in 1-2 sentences that can be fed to the image generation AI. " +
        "Please add 5-10 suggestions. Avoid using the same suggestion twice. " +
        "Use different styles of art settings, it is okay if the users doesn't use one of the provided suggestion directly but picks ideas from multiple suggestions. " +
        "For sorceries and instants describe the action or event that is happening. " +
        "For creatures use the name, power, toughness, rarity and rules (keywords and abilities) to describe the art setting. The rules should influence this quite a lot. " +
        "For noncreature permanents use the name of the card to describe the location or object and use the rules (keywords and abilities) to describe the setting. " +
        "In general, use different styles and approaches to naming the cards and describe what you would see in the world if the card would resolve.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Could you suggest some card settings for ${card.explain()}`
            }
          ]
        }
      ]
    });

    const respondError = (reason: string): ArtSettingSuggestion[] => [{ name: "No art setting suggestions available", setting: reason }];

    const message = msg.content.find(content => content.type === 'text')?.text;
    if (!message) {
      return respondError("No text was outputted by the AI model.");
    }

    try {
      return z.array(z.object({ name: z.string().min(1), setting: z.string().min(1) })).parse(JSON.parse(message));
    } catch (e) {
      return respondError("The response from the AI model was not valid JSON.");
    }
  }

  async generateCardArt(cardData: SerializedCard): Promise<ArtSuggestion[]> {
    const card = new Card(cardData);

    const prompt = this.cardArtPromptCreator.createPrompt(card);
    const isTallCard = card.types.includes('planeswalker') || card.supertype === 'token';
    const dimensions = isTallCard
      ? { width: 768, height: 1024 }
      : { width: 1024, height: 768 };
    const result = await this.leonardo.image.createGeneration({
      modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
      ...dimensions,
      public: false,
      prompt,
      numImages: 4,
    });

    const generationId = result.object?.sdGenerationJob?.generationId;
    console.info(`Card art suggestions for ${card.name} at generation: ${generationId}`);
    console.info('Prompt:', prompt);

    if (!generationId) {
      throw new Error('Failed to generate card art');
    }

    await sleep(5000);

    let retries = 0;
    let generation: GetGenerationByIdResponse | undefined;
    while (retries < 10) {
      try {
        generation = await this.leonardo.image.getGenerationById(generationId);
        if (generation.object?.generationsByPk?.status === 'COMPLETE') {
          break;
        }
        console.log(`Waiting for generation ${generationId} to complete...`);
        await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5 seconds before retrying
        retries++;
      } catch (error) {
        console.error(`Error fetching generation ${generationId}:`, error);
        throw new Error('Failed to fetch card art generation');
      }
    }

    const images = generation?.object?.generationsByPk?.generatedImages?.map(image => ({
      id: image.id!,
      url: image.url!,
    })) ?? [];

    if (images.length === 0) {
      throw new Error('No images found for the given generation ID');
    }

    // Download the images to the 'art/suggestions/' directory
    await fs.mkdir(this.artSuggestionDir, { recursive: true });
    const arts = await Promise.all(images.map(async (image) => {
      const imageResponse = await fetch(image.url);
      if (!imageResponse.ok) {
        console.error(`Failed to download image ${image.id} from ${image.url}`);
        return;
      }
      const buffer = await imageResponse.arrayBuffer();
      const cardId = computeCardId(card);
      const fileName = `${cardId}-${image.id}.png`;
      await fs.writeFile(`${this.artSuggestionDir}/${fileName}`, Buffer.from(buffer));
      console.log(`Saved art suggestion for ${cardId} (for image ${image.id}): ${fileName}`);
      return { fileName: `suggestions/${fileName}`, base64Image: Buffer.from(buffer).toString('base64') };
    }));

    return arts.filter((art): art is ArtSuggestion => art !== undefined);
  }
}

export const aiService = new AIService();
