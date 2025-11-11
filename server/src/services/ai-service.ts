import fs from 'fs/promises';
import { Card, CardArtPromptCreator, CardFace, SerializedCard, SerializedCardSchema } from 'kindred-paths';
import { Anthropic } from '@anthropic-ai/sdk';
import { Leonardo } from '@leonardo-ai/sdk';
import { z } from 'zod';
import { GetGenerationByIdResponse } from '@leonardo-ai/sdk/sdk/models/operations';
import { computeCardId } from '../utils/card-utils';
import { CardGenerator } from './generator/card-generator';
import { configuration } from '../configuration';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getCardInfo(card: Card) {
  return `a card with a ${card.layout} layout with the following faces:\n` + card.faces
    .map((f, index) => `face-${index + 1}: ${f.explain({ withoutName: true })}`)
    .join('\n');
}

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

  constructor() {
    this.anthropic = new Anthropic();
    this.leonardo = new Leonardo({
      bearerAuth: process.env.LEONARDO_API_KEY || '',
    });
    this.cardArtPromptCreator = new CardArtPromptCreator();
  }

  async getCardNameSuggestions(cardData: SerializedCard): Promise<NameSuggestion[]> {
    const card = new Card(cardData);
    const cardInfo = getCardInfo(card);
    const msg = await this.anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 1000,
      temperature: 1,
      system: "You're an expert in coming up with creative names for custom Magic the Gathering cards. " +
        'Always respond with a JSON array where each entry is a suggestion. ' +
        'Generate name suggestions and return ONLY valid JSON without any markdown formatting or code blocks. ' +
        'Return as an array of objects with "name" and "reason" properties. ' +
        'Each suggestion is an object with two properties. ' +
        "'name' - which is the name you suggest for the card. " +
        "'reason' - which is a short explanation of why you chose this name. " +
        'Please add 5-10 suggestions. Avoid using the same name twice. ' +
        "Use different styles of names, it is okay if the users doesn't use one of the provided suggestion directly but picks from multiple " +
        'suggestions. ' +
        'For sorceries and instants try to use the name either as something that happened or describes what happens when the spell resolves.' +
        "For creatures use names like 'Arabho, The Great', that have a given name and a title. " +
        'For noncreature permanents use names of places, objects, or concepts. That describe the context within what happens on the card could ' +
        'happen. ' +
        'For cards with multiple faces, please suggest a name for each face. For example: "Agadeem\'s Awakening // Agadeem, the Undercrypt". ' +
        'In general, use different styles and approaches to naming the cards.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Could you suggest some card names for ${cardInfo}`,
            },
          ],
        },
      ],
    });

    const respondError = (reason: string): NameSuggestion[] => [{ name: 'No name suggestions available', reason }];

    const message = msg.content.find(content => content.type === 'text')?.text;
    if (!message) {
      return respondError('No text was outputted by the AI model.');
    }

    try {
      return z.array(z.object({ name: z.string().min(1), reason: z.string().min(1) })).parse(JSON.parse(message));
    } catch {
      return respondError('The response from the AI model was not valid JSON.');
    }
  }

  async getCardArtSettingSuggestions(cardData: SerializedCard): Promise<ArtSettingSuggestion[]> {
    const card = new Card(cardData);

    const cardInfo = getCardInfo(card);
    const msg = await this.anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 1000,
      temperature: 1,
      system: "You're an expert in coming up with creative art settings for custom Magic the Gathering cards based on a given card. " +
        'Always respond with a JSON array where each entry is a suggestion for an art setting. ' +
        'An art setting describes what the card artist that will make the artwork for the card should create. ' +
        'The art setting should describe the location, what happens on the foreground, and what happens on the background. ' +
        'Generate art setting suggestions and return ONLY valid JSON without any markdown formatting or code blocks. ' +
        'Return as an array art setting suggestions, which are objects with "name" and "setting" properties. ' +
        'Each art setting suggestion is an object with two properties. ' +
        "'name' - which is a title for the art setting. " +
        "'setting' - which is the short art setting in 1-2 sentences that can be fed to the image generation AI. " +
        'Please add 5-10 suggestions. Avoid using the same suggestion twice. ' +
        "Use different styles of art settings, it is okay if the users doesn't use one of the provided suggestion directly but picks ideas from " +
        'multiple suggestions. ' +
        'For sorceries and instants describe the action or event that is happening. ' +
        'For creatures use the name, power, toughness, rarity and rules (keywords and abilities) to describe the art setting. The rules should ' +
        'influence this quite a lot. ' +
        'For noncreature permanents use the name of the card to describe the location or object and use the rules (keywords and abilities) to ' +
        'describe the setting. ' +
        'In general, use different styles and approaches to naming the cards and describe what you would see in the world if the card would resolve.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Could you suggest some card settings for ${cardInfo}`,
            },
          ],
        },
      ],
    });

    const respondError = (reason: string): ArtSettingSuggestion[] => [{ name: 'No art setting suggestions available', setting: reason }];

    const message = msg.content.find(content => content.type === 'text')?.text;
    if (!message) {
      return respondError('No text was outputted by the AI model.');
    }

    try {
      return z.array(z.object({ name: z.string().min(1), setting: z.string().min(1) })).parse(JSON.parse(message));
    } catch {
      return respondError('The response from the AI model was not valid JSON.');
    }
  }

  async generateCardArt(cardFace: CardFace): Promise<ArtSuggestion[]> {
    const prompt = this.cardArtPromptCreator.createPrompt(cardFace);
    const isTallCard = cardFace.types.includes('planeswalker') || cardFace.card.isToken;
    const dimensions = isTallCard
      ? { width: 1024, height: 1024 }
      : { width: 1024, height: 768 };
    const result = await this.leonardo.image.createGeneration({
      modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
      ...dimensions,
      public: false,
      prompt,
      numImages: 4,
    });

    const generationId = result.object?.sdGenerationJob?.generationId;
    console.info(`Card art suggestions for ${cardFace.name} at generation: ${generationId}`);
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
        retries += 1;
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
    await fs.mkdir(configuration.artSuggestionsDir, { recursive: true });
    const arts = await Promise.all(images.map(async (image) => {
      const imageResponse = await fetch(image.url);
      if (!imageResponse.ok) {
        console.error(`Failed to download image ${image.id} from ${image.url}`);
        return;
      }
      const buffer = await imageResponse.arrayBuffer();
      const cardId = computeCardId(cardFace.card.toJson()); // TODO: Verify multi-face cards
      const fileName = `${cardId}-${image.id}.png`;
      await fs.writeFile(`${configuration.artSuggestionsDir}/${fileName}`, Buffer.from(buffer));
      console.log(`Saved art suggestion for ${cardId} (for image ${image.id}): ${fileName}`);
      return { fileName: `suggestions/${fileName}`, base64Image: Buffer.from(buffer).toString('base64') };
    }));

    return arts.filter((art): art is ArtSuggestion => art !== undefined);
  }

  async getCardSamples(props: { prompt: string } | { generatorId: string }): Promise<{
    generatorId: string,
    samples: SerializedCard[],
  }> {
    let generatorId, prompt, createdAt, updatedAt;
    let preexistingSamples: SerializedCard[] = [];
    let iterationBudget = 3;
    const getFilePath = (generatorId: string) => {
      return `${configuration.generatorsCacheDir}/${generatorId}.json`;
    };
    if ('prompt' in props) {
      generatorId = crypto.randomUUID();
      prompt = props.prompt;
      iterationBudget = 6; // Generate more when using a new prompt
      createdAt = new Date().toISOString();
      updatedAt = createdAt;
    } else {
      generatorId = props.generatorId;
      const content = JSON.parse(await fs.readFile(getFilePath(generatorId), 'utf-8'));
      prompt = content.prompt;
      preexistingSamples = content.samples.map((s: SerializedCard) => {
        try {
          return new Card(SerializedCardSchema.parse(s));
        } catch (e) {
          console.error('Failed to parse existing sample, skipping.', e);
          return null;
        }
      }).filter((s: Card | null): s is Card => s !== null);
      createdAt = content.createdAt;
      updatedAt = new Date().toISOString();
    }
    const generator = new CardGenerator(this.anthropic, prompt);
    generator.prepopulateSamples(preexistingSamples);
    const samples = await generator.sample(iterationBudget);
    await fs.writeFile(getFilePath(generatorId), JSON.stringify({
      createdAt,
      updatedAt,
      prompt,
      samples: [...preexistingSamples, ...samples],
    }, null, 2), 'utf-8');
    return {
      generatorId,
      samples,
    };
  }

  async getCardSampleGenerators(): Promise<{
    generatorId: string,
    createdAt: string,
    updatedAt: string,
    prompt: string,
    sampleCount: number,
  }[]> {
    try {
      const files = await fs.readdir(configuration.generatorsCacheDir);
      return (await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => file.replace('.json', ''))
          .map(async (generatorId) => {
            const content = JSON.parse(await fs.readFile(`${configuration.generatorsCacheDir}/${generatorId}.json`, 'utf-8'));
            return {
              generatorId,
              createdAt: content.createdAt,
              updatedAt: content.updatedAt,
              prompt: content.prompt,
              sampleCount: Array.isArray(content.samples) ? content.samples.length : 0,
            };
          }),

      )).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (error) {
      console.error('Error reading generators directory:', error);
      return [];
    }
  }

  async getCardSampleGeneratorById(generatorId: string): Promise<{
    generatorId: string,
    createdAt: string,
    updatedAt: string,
    prompt: string,
    samples: SerializedCard[],
  } | undefined> {
    const content = JSON.parse(await fs.readFile(`${configuration.generatorsCacheDir}/${generatorId}.json`, 'utf-8'));
    const samples: Card[] = content.samples.map((s: SerializedCard) => {
      try {
        return new Card(SerializedCardSchema.parse(s));
      } catch (e) {
        console.error('Failed to parse existing sample, skipping.', e);
        return null;
      }
    }).filter((s: Card | null): s is Card => s !== null);
    return {
      generatorId,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
      prompt: content.prompt,
      samples: samples.map(s => s.toJson()),
    };
  }
}

export const aiService = new AIService();
