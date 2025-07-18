import fs from 'fs/promises';
import express from 'express';
import cors from 'cors';
import { Card, SerializedCardSchema, hash, SerializedCard } from 'kindred-paths';
import { CardConjurer } from './card-conjurer';

const set = {
  author: 'Simon Karman',
  shortName: 'KPA',
  symbol: 'ELD',
};

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

async function getExistingRender(key: string): Promise<Buffer | undefined> {
  try {
    const path = `./renders/${key}.png`;
    return await fs.readFile(path);
  }
  catch {
    return undefined;
  }
}

async function saveRender(key: string, image: Buffer): Promise<void> {
  const path = `./renders/${key}.png`;
  await fs.mkdir('./renders', { recursive: true });
  await fs.writeFile(path, image);
}

async function getRender(card: Card): Promise<Buffer> {
  const key = hash(JSON.stringify(card.toJson()));
  const existingRender = await getExistingRender(key);
  if (existingRender) {
    return existingRender;
  }
  const render = await cardConjurer.renderCard(card, set);
  await saveRender(key, render);
  return render;
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

app.get("/card/:id/render", async (req, res) => {
  const card = await getCardById(req.params.id);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${req.params.id} not found` });
    return;
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(await getRender(card));
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

app.post('/preview', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }
  const card = new Card(body.data);
  res.setHeader('Content-Type', 'image/png');
  res.send(await getRender(card));
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
