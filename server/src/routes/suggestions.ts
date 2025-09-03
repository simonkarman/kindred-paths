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
  maxIterations: z.number().min(1).max(10).default(3),
});
suggestionsRouter.post('/card', async (req, res) => {
  const body = SuggestCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid request data', details: body.error });
    return;
  }

  try {
    const { prompt, maxIterations } = body.data;
    const suggestedCard: Card | null = await aiService.suggestCard(prompt, maxIterations);
    if (suggestedCard) {
      res.json(suggestedCard.toJson());
    } else {
      res.status(500).json({ error: `Failed to suggest card within ${maxIterations} iterations` });
    }
  } catch (error) {
    console.error('Error suggesting card:', error);
    res.status(500).json({ error: 'Failed to suggest card' });
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
