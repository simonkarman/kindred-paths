import { Router } from 'express';
import { SerializedCardSchema } from 'kindred-paths';
import { cardService } from '../services/card-service';

export const cardsRouter = Router();

cardsRouter.get('/', async (_, res) => {
  const cards = await cardService.getAllCards();
  if (cards.length === 0) {
    res.status(404).json({ error: 'No cards found' });
  } else {
    res.json(cards);
  }
});

cardsRouter.get('/:cid', async (req, res) => {
  const cid = req.params.cid;
  const card = await cardService.getCardByCid(cid);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${cid} not found` });
    return;
  }
  res.send(card.toJson());
});

cardsRouter.delete('/:cid', async (req, res) => {
  const cid = req.params.cid;
  try {
    const card = await cardService.getCardByCid(cid);
    if (!card) {
      res.status(404).json({ error: `Card with ID ${cid} not found` });
      return;
    }
    card.tags['deleted'] = true;
    await cardService.saveCard(card.toJson());
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting card ${cid}:`, error);
    res.status(500).json({ error: `Failed to delete card with ID ${cid}` });
  }
});

cardsRouter.post('/', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const result = await cardService.createCard(body.data);
    if (result.success) {
      res.status(201).json(result.card);
    } else {
      res.status(result.statusCode).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

cardsRouter.put('/:cid', async (req, res) => {
  const cid = req.params.cid;
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const result = await cardService.updateCard(cid, body.data);
    if (result.success) {
      res.status(200).json(result.card);
    } else {
      res.status(result.statusCode).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});
