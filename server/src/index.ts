import fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { Card, SerializedCardSchema, hash, SerializedCard } from 'kindred-paths';
import { CardConjurer } from './card-conjurer';
import sharp from 'sharp';

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
  const { render } = await getRender(card);
  res.send(render);
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

cardConjurer.start().then(() => {
  const port = process.env.PORT || 4101;
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}).catch((e: unknown) => {
  console.error(`[ERROR] Unable to access Card Conjurer at ${cardConjurer.url}. Is it running?`, e);
  process.exit(1);
});
