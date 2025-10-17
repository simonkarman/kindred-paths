import { Router } from 'express';
import { SerializedCardSchema } from 'kindred-paths';
import { cardService } from '../services/card-service';

export const cardsRouter = Router();

cardsRouter.get('/', async (req, res) => {
  const cards = await cardService.getAllCards();
  if (cards.length === 0) {
    res.status(404).json({ error: 'No cards found' });
  } else {
    res.json(cards);
  }
});

cardsRouter.get('/:id', async (req, res) => {
  const cardId = req.params.id;
  const card = await cardService.getCardById(cardId);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${req.params.id} not found` });
    return;
  }
  res.send(card.toJson());
});

cardsRouter.delete('/:id', async (req, res) => {
  const cardId = req.params.id;
  try {
    const card = await cardService.getCardById(cardId);
    if (!card) {
      res.status(404).json({ error: `Card with ID ${cardId} not found` });
      return;
    }
    card.tags['deleted'] = true;
    await cardService.saveCard(card);
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting card ${cardId}:`, error);
    res.status(500).json({ error: `Failed to delete card with ID ${cardId}` });
  }
});

cardsRouter.get('/:id/explain', async (req, res) => {
  const card = await cardService.getCardById(req.params.id);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${req.params.id} not found` });
    return;
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(card.explain());
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

cardsRouter.put('/:id', async (req, res) => {
  const previousCardId = req.params.id;
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const result = await cardService.updateCard(previousCardId, body.data);
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
