import { Router } from 'express';
import { Card, SerializedCardSchema } from 'kindred-paths';
import { aiService } from '../services/ai-service';
import { cardService } from '../services/card-service';
import fs from 'fs/promises';
import { z } from 'zod';

export const suggestionsRouter = Router();

suggestionsRouter.post('/name', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const suggestions = await aiService.getCardNameSuggestions(body.data);
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating name suggestions:', error);
    res.status(500).json({ error: 'Failed to generate name suggestions' });
  }
});

const SuggestCardSchema = z.object({
  prompt: z.string(),
});
suggestionsRouter.post('/card', async (req, res) => {
  const body = SuggestCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid request data', details: body.error });
    return;
  }

  try {
    const { prompt } = body.data;
    const suggestedCards: Card[] = await aiService.suggestCards(prompt);
    res.json(suggestedCards.map(c => ({
      ...c.toJson(), id: '<new>',
    })));
  } catch (error) {
    console.error('Error suggesting card:', error);
    res.status(500).json({ error: 'An error occurred while trying to suggest card a card' });
  }
})

suggestionsRouter.post('/art-setting', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const suggestions = await aiService.getCardArtSettingSuggestions(body.data);
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating art setting suggestions:', error);
    res.status(500).json({ error: 'Failed to generate art setting suggestions' });
  }
});

suggestionsRouter.post('/art', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const suggestions = await aiService.generateCardArt(body.data);
    res.json(suggestions);
  } catch (error) {
    console.error('Error generating art suggestions:', error);
    res.status(500).json({ error: 'Failed to generate art suggestions' });
  }
});

suggestionsRouter.get('/art/:id', async (req, res) => {
  const cardId = req.params.id;

  // Check if the card exists
  const card = await cardService.getCardById(cardId);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${cardId} not found` });
    return;
  }

  try {
    const artSuggestionDir = './art/suggestions';
    const files = await fs.readdir(artSuggestionDir);
    const suggestions = files
      .filter(file => file.startsWith(`${cardId}-`) && file.endsWith('.png'))
      .map(file => ({
        fileName: `suggestions/${file}`,
        base64Image: fs.readFile(`${artSuggestionDir}/${file}`, 'base64'),
      }));
    res.json(suggestions);
  } catch (error) {
    console.error(`Error reading art suggestions for card ID ${cardId}:`, error);
    res.status(500).json({ error: 'Failed to read art suggestions' });
  }
});
