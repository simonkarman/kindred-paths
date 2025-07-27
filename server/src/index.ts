import fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { Card, SerializedCardSchema, hash, SerializedCard } from 'kindred-paths';
import { CardConjurer } from './card-conjurer';
import sharp from 'sharp';
import { Anthropic } from '@anthropic-ai/sdk';
import { Leonardo } from "@leonardo-ai/sdk";
import { z } from 'zod';
import { GetGenerationByIdResponse } from '@leonardo-ai/sdk/sdk/models/operations';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const set = {
  author: 'Simon Karman',
  shortName: 'KPA',
  symbol: 'ELD',
};

const computeCardIdFromName = (name: string) => {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
}

let cardConjurerUrl = process.env.CARD_CONJURER_URL || "http://localhost:4102";
const cardConjurer = new CardConjurer(cardConjurerUrl);
const app = express();
app.use(express.json());
app.use(cors());

async function getAllCards(): Promise<SerializedCard[]> {
  try {
    const files = await fs.readdir('./set');
    return await Promise.all(files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
      .map(async (id) => {
        const card = await getCardById(id);
        return card!.toJson();
      })
    );
  } catch (error) {
    console.error('Error reading set directory:', error);
    return [];
  }
}

async function getCardById(id: string): Promise<Card | undefined> {
  try {
    const data = await fs.readFile(`./set/${id}.json`, 'utf-8');
    const parsed = JSON.parse(data);
    parsed.id = id;
    const result = SerializedCardSchema.safeParse(parsed);
    if (result.success) {
      return new Card(result.data);
    } else {
      console.error('Invalid card data:', result.error);
      return undefined;
    }
  } catch (error) {
    console.error(`Error reading card ${id}:`, error);
    return undefined;
  }
}

async function saveCard(card: Card): Promise<void> {
  const serializedCard = card.toJson();
  const path = `./set/${card.id}.json`;
  await fs.mkdir('./set', { recursive: true });
  await fs.writeFile(path, JSON.stringify({ ...serializedCard, id: undefined }, null, 2), 'utf-8');
}

async function getExistingRender(key: string): Promise<Buffer | undefined> {
  try {
    const path = `./renders/${key}.png`;
    return await fs.readFile(path);
  }
  catch {
    return undefined;
  }
}

async function saveRender(key: string, render: Buffer): Promise<void> {
  const path = `./renders/${key}.png`;
  await fs.mkdir('./renders', { recursive: true });
  await fs.writeFile(path, render);
}

async function getRender(card: Card): Promise<{ fromCache: boolean, render: Buffer }> {
  const key = hash(JSON.stringify({ ...card.toJson(), id: undefined, tags: undefined }));
  const existingRender = await getExistingRender(key);
  if (existingRender) {
    return { fromCache: true, render: existingRender };
  }
  const render = await cardConjurer.renderCard(card, set);
  await saveRender(key, render);
  return { fromCache: false, render };
}

app.get('/card', async (req, res) => {
  const cards = await getAllCards();
  if (cards.length === 0) {
    res.status(404).json({ error: 'No cards found' });
  } else {
    res.json(cards);
  }
});

app.get('/card/:id', async (req, res) => {
  const cardId = req.params.id;
  const card = await getCardById(cardId);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${req.params.id} not found` });
    return;
  }
  res.send(card.toJson());
});

app.delete('/card/:id', async (req, res) => {
  const cardId = req.params.id;
  try {
    const card = await getCardById(cardId);
    if (!card) {
      res.status(404).json({ error: `Card with ID ${cardId} not found` });
      return;
    }
    card.tags['deleted'] = true;
    await saveCard(card);
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting card ${cardId}:`, error);
    res.status(500).json({ error: `Failed to delete card with ID ${cardId}` });
  }
});

app.get("/render/:id", async (req, res) => {
  const card = await getCardById(req.params.id);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${req.params.id} not found` });
    return;
  }

  res.setHeader('Content-Type', 'render/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Disposition', `inline; filename="${card.collectorNumber}-${card.id}.png"`);

  let { render } = await getRender(card);
  const quality = req.query.quality ? parseInt(req.query.quality as string) : 100;
  const scale = req.query.scale ? parseFloat(req.query.scale as string) : 1;
  if (quality < 0 || quality > 100) {
    res.status(400).json({ error: 'Quality must be between 0 and 100' });
    return;
  }
  if (scale <= 0 || scale > 1) {
    res.status(400).json({ error: 'Scale must be between 0 and 1' });
    return;
  }

  // Scale the render if scale is not 1
  if (scale !== 1) {
    render = await sharp(render).resize({ width: Math.round(2010 * scale), height: Math.round(2814 * scale) }).toBuffer();
  }

  // Compress the render if quality is less than 100
  if (quality !== 100) {
    render = await sharp(render).png({ quality }).toBuffer();
  }
  res.send(render);
});

app.get("/card/:id/explain", async (req, res) => {
  const card = await getCardById(req.params.id);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${req.params.id} not found` });
    return;
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(card.explain());
});

app.post('/card', async (req, res) => {
  // Validate the request body against the SerializedCardSchema
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  // Set the ID based on the card name
  const id = computeCardIdFromName(body.data.name);

  // Check if card with this ID already exists
  const existingCard = await getCardById(id);
  if (existingCard) {
    res.status(409).json({ error: `Card with ID ${id} already exists` });
    return;
  }

  // Try to create a new Card instance
  let card;
  try {
    card = new Card({ ...body.data, id });
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(400).json({ error: 'Invalid card data', details: error });
    return;
  }

  // Save the card and return the response
  try {
    await saveCard(card);
    res.status(201).json(card.toJson());
  } catch (error) {
    console.error('Error saving card:', error);
    res.status(500).json({ error: 'Failed to save card' });
  }
});

app.put('/card/:id', async (req, res) => {
  const cardId = req.params.id;
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  // Check if the card exists
  const existingCard = await getCardById(cardId);
  if (!existingCard) {
    res.status(404).json({ error: `Card with ID ${cardId} not found` });
    return;
  }

  // Update the card with new data
  let card;
  try {
    card = new Card({ ...body.data, id: cardId });
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(400).json({ error: 'Invalid card data', details: error });
    return;
  }

  // Save the updated card
  try {
    await saveCard(card);
    res.status(200).json(card.toJson());
  } catch (error) {
    console.error('Error saving updated card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

app.post('/preview', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }
  const card = new Card(body.data);
  res.setHeader('Content-Type', 'image/png');
  const { render, fromCache } = await getRender(card);
  res.send(render);

  // Save the card json to the previews directory
  if (!fromCache) {
    const previewId = `${new Date().toISOString()}-${computeCardIdFromName(card.name)}`;
    const previewPath = `./previews/${previewId}.json`;
    await fs.mkdir('./previews', { recursive: true });
    await fs.writeFile(previewPath, JSON.stringify(card.toJson(), null, 2), 'utf-8');
  }
});

app.post('/cleanup', async (req, res) => {
  const messages: string[] = [];

  // Rename cards that have an ID different from the computed ID based on their name
  for (const card of await getAllCards()) {
    const cardId = computeCardIdFromName(card.name);
    if (card.id !== cardId) {
      const message = `renamed card ${card.id} to ${cardId}`;
      messages.push(message);
      await fs.rename(`./set/${card.id}.json`, `./set/${cardId}.json`);
      console.log(message);
    }
  }

  // Ensure all keywords are lowercase
  for (const card of await getAllCards()) {
    if (!card.rules) continue;

    let hasChanged = false;
    card.rules = card.rules.map(rule => {
      if (rule.variant === 'keyword') {
        const content = rule.content.toLowerCase();
        if (rule.content !== content) {
          hasChanged = true;
        }
        return { ...rule, content, };
      }
      return rule;
    });
    if (hasChanged) {
      const message = `updated keywords to lowercase for card ${card.id}`;
      messages.push(message);
      await saveCard(new Card(card));
      console.log(message);
    }
  }

  // Ensure no cards reference art that is still a suggestion
  for (const card of await getAllCards()) {
    if (card.art && card.art.startsWith('suggestions/')) {
      const message = `removed art suggestion for card ${card.id}: ${card.art}`;
      messages.push(message);
      delete card.art;
      await saveCard(new Card(card));
      console.log(message);
    }
  }

  // Render all cards
  for (const card of await getAllCards()) {
    try {
      const { fromCache } = await getRender(new Card(card));
      if (!fromCache) {
        const message = `rendered card ${card.id}`;
        messages.push(message);
        console.log(message);
      }
    } catch (error) {
      const message = `failed to render card ${card.id}: ${(error as Error).message}`;
      messages.push(message);
      console.error(message);
    }
  }

  res.json({ message: 'Cleanup completed', details: messages });
});

const aiCardNameSuggestions = async (card: Card) => {
  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 1000,
    temperature: 1,
    system: "You're an expert in coming up with creative names for custom Magic the Gathering cards. " +
      "Always respond with a JSON array where each entry is a suggestion. " +
      "Generate name suggestions and return ONLY valid JSON without any markdown formatting or code blocks. " +
      "Return as an array of objects with \"name\" and \"reason\" properties. " +
      "Each suggestion is an object with two properties. " +
      "'name' - which is the the name you suggest for the card. " +
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
            text: `Could you suggest some card names for ${card.explain({ withoutName: true})}`
          }
        ]
      }
    ]
  });

  const respondError = (reason: string) => [{ name: "No suggestions available", reason }];

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

app.post('/suggest/name', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }
  const card = new Card(body.data);
  res.json(await aiCardNameSuggestions(card));
});

const leonardo = new Leonardo({
  bearerAuth: process.env.LEONARDO_API_KEY || '',
});
app.post('/suggest/art', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }
  const card = new Card(body.data);

  const result = await leonardo.image.createGeneration({
    // wxh 1710x1250 - ratio 1.368 (see placeholder.png)
    modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3',
    width: 1024,
    height: 768,
    public: false,
    prompt: `A Magic the Gathering card art for a custom card named "${card.name}". Artwork in the style of Magic: The Gathering artists like Johannes Voss, Chris Rahn, or Magali Villeneuve, focusing on a dynamic character/action moment that tells a clear story within a single frame, where the main subject takes up approximately 60% of the composition with supporting environmental elements enhancing the scene's impact. For the card: ${card.explain()}.`,
    numImages: 2,
  });
  const generationId = result.object?.sdGenerationJob?.generationId;
  console.info(`Card art suggestions for ${card.name} at generation: ${generationId}`);
  if (!generationId) {
    res.status(500).json({ error: 'Failed to generate card art' });
    return;
  }
  await sleep(5000);

  let retries = 0;
  let generation: GetGenerationByIdResponse | undefined;
  while (retries < 10) {
    try {
      generation = await leonardo.image.getGenerationById(generationId);
      if (generation.object?.generationsByPk?.status === 'COMPLETE') {
        break;
      }
      console.log(`Waiting for generation ${generationId} to complete...`);
      await new Promise(resolve => setTimeout(resolve, 2500)); // Wait 2.5 seconds before retrying
      retries++;
    } catch (error) {
      console.error(`Error fetching generation ${generationId}:`, error);
      res.status(500).json({ error: 'Failed to fetch card art generation' });
      return;
    }
  }
  const images = generation?.object?.generationsByPk?.generatedImages?.map(image => ({
    id: image.id!,
    url: image.url!,
  })) ?? [];
  if (images.length === 0) {
    res.status(404).json({ error: 'No images found for the given generation ID' });
    return;
  }

  // Download the images to the 'art/suggestions/' directory
  const dir = './art/suggestions';
  await fs.mkdir(dir, { recursive: true });
  const arts = await Promise.all(images.map(async (image) => {
    const imageResponse = await fetch(image.url);
    if (!imageResponse.ok) {
      console.error(`Failed to download image ${image.id} from ${image.url}`);
      return;
    }
    const buffer = await imageResponse.arrayBuffer();
    const cardId = computeCardIdFromName(card.name);
    const fileName = `${cardId}-${image.id}.png`;
    await fs.writeFile(`${dir}/${fileName}`, Buffer.from(buffer));
    console.log(`Saved art suggestion for ${cardId} (for image ${image.id}): ${fileName}`);
    return { art: `suggestions/${fileName}` };
  }));
  res.json(arts);
});

cardConjurer.start().then(() => {
  const port = process.env.PORT || 4101;
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}).catch((e: unknown) => {
  console.error(`[ERROR] Unable to access Card Conjurer at ${cardConjurer.url}. Is it running?`, e);
  process.exit(1);
});
