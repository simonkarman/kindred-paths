import { Router } from 'express';
import { SerializableSetSchema, Set } from 'kindred-paths';
import { z } from 'zod';
import { setService } from '../services/set-service';

export const setsRouter = Router();

setsRouter.get('/', async (_, res) => {
  const sets: Set[] = await setService.getAll();
  res.json(sets.map(s => ({
    name: s.getName(),
    matricesCount: s.getMatrixCount(),
    validCardCount: s.getMatrices().map(m => m.getValidCardCount()).reduce((a, b) => a + b, 0),
    cardCount: s.getMatrices().map(m => m.getTotalNonSkippedCardCount()).reduce((a, b) => a + b, 0),
  })));
});

setsRouter.post('/', async (req, res) => {
  const { name: setName } = z.object({ name: z.string() }).parse(req.body);
  try {
    const result: { success: true } | { success: false, error: unknown } = await setService.createSet(setName);
    if (result.success) {
      res.status(201).json({ name: setName });
    } else {
      res.status(400).json({ message: 'Cannot create set. Please fix.', error: result.error });
    }
  } catch (error) {
    console.error('Error creating set:', error);
    res.status(500).json({ error: 'Failed to create set' });
  }
});

setsRouter.get('/:name', async (req, res) => {
  const setName = z.string().parse(req.params.name);
  const set: Set | undefined = await setService.getSetByName(setName);
  if (!set) {
    res.status(404).json({ error: `Set with name "${req.params.name}" not found` });
    return;
  }
  res.send(set.toJson());
});

setsRouter.put('/:name', async (req, res) => {
  const setName = req.params.name;
  const body = SerializableSetSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: 'Invalid set data', details: body.error });
    return;
  }

  try {
    const result = await setService.updateSet(setName, new Set(body.data));
    if (result.success) {
      res.status(200).json({ success: 'OK' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error updating set:', error);
    res.status(500).json({ error: 'Failed to update set' });
  }
});
