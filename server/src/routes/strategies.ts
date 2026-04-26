import { Router } from 'express';
import { SerializableStrategiesConfigSchema } from 'kindred-paths';
import { z } from 'zod';
import fs from 'fs/promises';
import { configuration } from '../configuration';

export const strategiesRouter = Router();

strategiesRouter.get('/', async (_req, res) => {
  try {
    const files = await fs.readdir(configuration.strategiesDir);
    const names = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.slice(0, -5));
    res.json(names);
  } catch {
    res.json([]);
  }
});

strategiesRouter.get('/:set', async (req, res) => {
  const setName = z.string().parse(req.params.set).toLowerCase();
  const path = `${configuration.strategiesDir}/${setName}.json`;
  try {
    const data = await fs.readFile(path, 'utf-8');
    const parsed = SerializableStrategiesConfigSchema.safeParse(JSON.parse(data));
    if (!parsed.success) {
      res.status(422).json({ error: 'Invalid strategies config', details: parsed.error });
      return;
    }
    res.json(parsed.data);
  } catch {
    res.status(404).json({ error: `No strategies config found for set "${setName}"` });
  }
});

strategiesRouter.put('/:set', async (req, res) => {
  const setName = z.string().parse(req.params.set).toLowerCase();
  const path = `${configuration.strategiesDir}/${setName}.json`;
  const parsed = SerializableStrategiesConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'Invalid strategies config', details: parsed.error });
    return;
  }
  try {
    await fs.writeFile(path, JSON.stringify(parsed.data, null, 2), 'utf-8');
    res.json(parsed.data);
  } catch {
    res.status(500).json({ error: `Failed to write strategies config for set "${setName}"` });
  }
});
