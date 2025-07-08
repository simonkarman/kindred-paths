import express from 'express';
import { z } from 'zod';
import { Card } from './card';
import { abzanDevotee, blindObedience, craterhoofBehemoth, emry, herdHeirloom, tundra } from './example-cards';
import { CardConjurer } from './card-conjurer';

const CardSchema = z.object({
  set: z.object({ symbol: z.string().min(1), shortName: z.string().min(1) }),
  id: z.number().int().min(1),
  name: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  supertype: z.enum(['basic', 'legendary']).optional(),
  types: z.array(z.enum(['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'land'])).nonempty(),
  subtypes: z.array(z.string().min(1)).optional(),
  manaCost: z.record(z.enum(['white', 'blue', 'black', 'red', 'green', 'colorless']), z.number().int().nonnegative()).default({}),
  rules: z.array(z.object({
    variant: z.enum(['reminder', 'keyword', 'ability', 'inline-reminder', 'flavor']),
    content: z.string().min(1),
  })).optional(),
  pt: z.object({
    power: z.number().int().nonnegative(),
    toughness: z.number().int().nonnegative(),
  }).optional(),
  art: z.object({ image: z.string().min(1), author: z.string().min(1) }).optional(),
});

let cardConjurerUrl = process.env.CARD_CONJURER_URL || "http://localhost:4242";
const cardConjurer = new CardConjurer(cardConjurerUrl);
const app = express();
app.use(express.json());

app.get('/cards/examples', (_, res) => {
  const cards = [emry, abzanDevotee, herdHeirloom, craterhoofBehemoth, tundra, blindObedience];
  res.send(cards.map(card => card.toReadableString()).join('\n\n'));
});

const images: {[data: string]: Buffer } = {};
app.post('/cards/render', async (req, res) => {
  const body = CardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }
  const key = JSON.stringify(body.data);
  if (images[key]) {
    res.setHeader('Content-Type', 'image/png');
    res.send(images[key]);
    return;
  }
  const card = new Card(body.data);
  res.setHeader('Content-Type', 'image/png');
  const image = await cardConjurer.renderCard(card);
  images[key] = image;
  res.send(image);
});

cardConjurer.start().then(() => {
  const port = process.env.PORT || 4243;
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}).catch((e: unknown) => {
  console.error(`[ERROR] Unable to access Card Conjurer at ${cardConjurer.url}. Is it running?`, e);
  process.exit(1);
});
