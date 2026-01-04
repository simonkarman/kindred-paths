import { Router, Response } from 'express';
import { SerializedCardSchema } from 'kindred-paths';
import { cardService } from '../services/card-service';
import { renderService } from '../services/render-service';
import sharp from 'sharp';

export const renderRouter = Router();

async function sendImage(res: Response, render: Buffer, filename: string, quality: number, scale: number) {
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

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(render);
}

renderRouter.get('/render/:id/:faceIndex', async (req, res) => {
  // Get information from request
  const cardId = req.params.id;
  const faceIndex = Number.parseInt(req.params.faceIndex);

  const force = [1, true, '1', 'true', 'yes', 'y', 'on'].includes(req.query.force as string);
  const quality = req.query.quality ? parseInt(req.query.quality as string) : 100;
  const scale = req.query.scale ? parseFloat(req.query.scale as string) : 1;

  // Try and find the card
  const card = await cardService.getCardById(cardId);
  if (!card) {
    res.status(404).json({ error: `Card with ID ${cardId} not found` });
    return;
  }

  if (isNaN(faceIndex) || faceIndex < 0 || faceIndex >= card.faces.length) {
    res.status(400).json({ error: `Invalid face index ${faceIndex}` });
    return;
  }
  const cardFace = card.faces[faceIndex];
  const { render } = await renderService.getRender(cardFace, force);
  const filename = `${card.id}-${faceIndex}.png`;
  await sendImage(res, render, filename, quality, scale);
});

renderRouter.post('/preview/:faceIndex', async (req, res) => {
  const body = SerializedCardSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid card data', details: body.error });
    return;
  }

  const faceIndex = Number.parseInt(req.params.faceIndex);
  if (isNaN(faceIndex) || faceIndex < 0 || faceIndex >= body.data.faces.length) {
    res.status(400).json({ error: `Invalid face index ${faceIndex}` });
    return;
  }

  const quality = req.query.quality ? parseInt(req.query.quality as string) : 100;
  const scale = req.query.scale ? parseFloat(req.query.scale as string) : 1;

  try {
    const { render } = await renderService.generatePreview(body.data, faceIndex);
    await sendImage(res, render, 'preview.png', quality, scale);
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});
