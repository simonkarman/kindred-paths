import { Router } from 'express';
import { z } from 'zod';
import { cardService } from '../services/card-service';
import { Card, filterCardsBasedOnSearch } from 'kindred-paths';

export const organizeRouter = Router();

type CollectorNumberInfo = { collectorNumber: number, cardId: string, faces: { name: string, renderedTypeLine: string }[] };

organizeRouter.post('/collector-numbers', async (req, res) => {
  const searchQuery = z.string().safeParse(req.body.query);
  if (!searchQuery.success) {
    res.status(400).json({ error: 'Invalid query parameter' });
    return;
  }

  const cards = filterCardsBasedOnSearch(await cardService.getAllCards(), searchQuery.data);
  const response: CollectorNumberInfo[] = cards.map(c => new Card(c)).map(card => ({
    collectorNumber: card.collectorNumber,
    cardId: card.id,
    faces: card.faces.map(face => ({ name: face.name, renderedTypeLine: face.renderTypeLine() })),
  }));
  res.json(response);
});
