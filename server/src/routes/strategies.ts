import { Router } from 'express';
import { SerializableStrategiesConfigSchema } from 'kindred-paths';
import { z } from 'zod';
import fs from 'fs/promises';
import { configuration } from '../configuration';

export const strategiesRouter = Router();

strategiesRouter.get('/', async (_req, res) => {
  try {
    const files = await fs.readdir(configuration.strategiesDir);
    const filenames = files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
    const metas = await Promise.all(
      filenames.map(async filename => {
        try {
          const raw = await fs.readFile(`${configuration.strategiesDir}/${filename}.json`, 'utf-8');
          const parsed = JSON.parse(raw);
          return {
            filename,
            name: typeof parsed.name === 'string' && parsed.name ? parsed.name : filename,
            ...(typeof parsed.description === 'string' && parsed.description ? { description: parsed.description } : {}),
          };
        } catch {
          return { filename, name: filename };
        }
      }),
    );
    res.json(metas);
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

strategiesRouter.post('/', async (req, res) => {
  const nameResult = z.string().min(1).safeParse(req.body?.name);
  if (!nameResult.success) {
    res.status(422).json({ error: 'A non-empty name is required.' });
    return;
  }
  const setName = nameResult.data.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const path = `${configuration.strategiesDir}/${setName}.json`;
  try {
    await fs.access(path);
    // File already exists
    res.status(409).json({ error: `A strategy file named "${setName}" already exists.` });
    return;
  } catch {
    // Does not exist — safe to create
  }
  const newConfig = { name: nameResult.data, strategies: [] };
  try {
    await fs.writeFile(path, JSON.stringify(newConfig, null, 2), 'utf-8');
    res.status(201).json({ filename: setName });
  } catch {
    res.status(500).json({ error: `Failed to create strategy file "${setName}"` });
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

strategiesRouter.delete('/:set', async (req, res) => {
  const setName = z.string().parse(req.params.set).toLowerCase();
  const path = `${configuration.strategiesDir}/${setName}.json`;
  try {
    await fs.unlink(path);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: `Strategy file "${setName}" not found.` });
  }
});
