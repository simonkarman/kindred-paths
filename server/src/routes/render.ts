import { Router } from 'express';
import { SerializedCardSchema } from 'kindred-paths';
import { cardService } from '../services/card-service';
import { renderService } from '../services/render-service';
import sharp from 'sharp';

export const renderRouter = Router();

renderRouter.get('/render/:id', async (req, res) => {
  // Get information from request
  const cardId = req.params.id;
  const force = [1, true, '1', 'true', 'yes', 'y', 'on'].includes(req.query.force as string);
  const quality = req.query.quality ? parseInt(req.query.quality as string) : 100;
  const scale = req.query.scale ? parseFloat(req.query.scale as string) : 1;

  // Try and find the card
  const card = await cardService.getCardById(cardId);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${cardId} not found` });
    return;
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Disposition', `inline; filename="${card.collectorNumber}-${card.id}.png"`);
  let { render } = await renderService.getRender(card, force);
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

renderRouter.post('/preview', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  try {
    const result = await renderService.generatePreview(body.data);
    res.setHeader('Content-Type', 'image/png');
    res.send(result.render);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});
