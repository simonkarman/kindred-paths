import { Router } from 'express';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { z } from 'zod';
import { cardService } from '../services/card-service';
import { computeCardId } from '../utils/card-utils';
import { configuration } from '../configuration';
import { Card } from 'kindred-paths';

export const LegacySerializedCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: z.enum(['common', 'uncommon', 'rare', 'mythic']),
  isToken: z.literal(true).optional(),
  supertype: z.enum(['basic', 'legendary']).optional(),
  tokenColors: z.array(z.enum(['white', 'blue', 'black', 'red', 'green'])).optional(),
  types: z.array(z.enum(['creature', 'enchantment', 'artifact', 'instant', 'sorcery', 'land', 'planeswalker'])).nonempty(),
  subtypes: z.array(z.string().min(1)).optional(),
  manaCost: z.record(z.enum(['white', 'blue', 'black', 'red', 'green', 'colorless', 'x']), z.number().int().nonnegative()).default({}),
  rules: z.array(z.object({
    variant: z.enum(['card-type-reminder', 'keyword', 'ability', 'inline-reminder', 'flavor']),
    content: z.string().min(1),
  })).optional(),
  pt: z.object({
    power: z.number().int().nonnegative(),
    toughness: z.number().int().nonnegative(),
  }).optional(),
  loyalty: z.number().int().nonnegative().optional(),
  collectorNumber: z.number().int().min(1),
  art: z.string().min(5).regex(/.+\.(jpeg|jpg|png)$/i).optional(),
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.undefined()])).optional(),
});

export const maintenanceRouter = Router();

maintenanceRouter.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

maintenanceRouter.post('/cleanup', async (_, res) => {
  const messages: string[] = [];
  console.info('Cleanup requested...');

  // Check if any cards are using legacy serialization and transform them
  await cardService.forEachCardFile(async (id) => {
    const fileContent = await cardService.getCardFileContent(id);
    let legacyCard;
    try {
      legacyCard = LegacySerializedCardSchema.parse(fileContent);
    } catch {
      return;
    }

    // Transform legacy card mana cost to new format
    const manaCost = (legacyCard.isToken || legacyCard.supertype === 'basic' || (legacyCard.types.length === 1 && legacyCard.types[0] === 'land'))
      ? undefined
      : legacyCard.manaCost;

    let card;
    try {
      console.info(`Transforming legacy serialized card ${legacyCard.id}...`);
      console.info('From:', legacyCard);
      const cardData = {
        id: legacyCard.id,
        isToken: legacyCard.isToken,
        rarity: legacyCard.rarity,
        collectorNumber: legacyCard.collectorNumber,
        tags: legacyCard.tags,
        faces: [{
          name: legacyCard.name,
          tokenColors: legacyCard.tokenColors,
          manaCost,
          types: legacyCard.types,
          subtypes: legacyCard.subtypes,
          supertype: legacyCard.supertype,
          rules: legacyCard.rules,
          pt: legacyCard.pt,
          loyalty: legacyCard.loyalty,
          art: legacyCard.art,
        }],
      };
      console.info('To:', cardData);
      card = new Card(cardData);
    }
    catch (e) {
      console.error(
        `\n\ncard failure ${id}:\n`,
        e,
        legacyCard.isToken,
        legacyCard.supertype === 'basic',
        legacyCard.types.length === 1,
        legacyCard.types[0] === 'land',
        manaCost,
      );
      throw e;
    }

    // If parsing succeeds, the card is in legacy format and needs to be transformed
    const message = `transformed legacy serialized card ${legacyCard.id} to new format`;
    messages.push(message);
    await cardService.saveCard(card.toJson());
    console.log(message);
  });

  // Rename cards that have an ID different from the computed ID based on their name
  for (const card of await cardService.getAllCards()) {
    const computedCardId = computeCardId(card);
    if (card.id !== computedCardId) {
      // check that the computed card id does not already exist
      const existingCard = await cardService.getCardById(computedCardId);
      if (existingCard) {
        const message = `skipped renaming card ${card.id} to ${computedCardId} because a card with that id already exists`;
        messages.push(message);
        console.warn(message);
        continue;
      }

      const message = `renamed card ${card.id} to ${computedCardId}`;
      messages.push(message);
      await fs.rename(`${configuration.cardsDir}/${card.id}.json`, `${configuration.cardsDir}/${computedCardId}.json`);
      console.log(message);
    }
  }

  // Ensure all keywords are lowercase
  for (const card of await cardService.getAllCards()) {
    let hasChanged = false;
    card.faces.forEach(face => {
      face.rules = face.rules?.map(rule => {
        if (rule.variant === 'keyword') {
          const content = rule.content.toLowerCase();
          if (rule.content !== content) {
            hasChanged = true;
          }
          return { ...rule, content };
        }
        return rule;
      });
    });
    if (hasChanged) {
      const message = `updated keywords to lowercase for card ${card.id}`;
      messages.push(message);
      await cardService.saveCard(card);
      console.log(message);
    }
  }

  // Ensure that 0 values in the mana cost are removed
  for (const card of await cardService.getAllCards()) {
    let hasChanged = false;
    card.faces.forEach(face => {
      if (!face.manaCost || !Object.values(face.manaCost).includes(0)) {
        return; // No 0 values to remove
      }
      hasChanged = true;

      // Create a new mana cost object without 0 values
      const newManaCost: { [key: string]: number } = {};
      for (const [key, value] of Object.entries(face.manaCost)) {
        if (value !== 0) {
          newManaCost[key] = value;
        }
      }

      // Update the card with the new mana cost
      face.manaCost = newManaCost;
    });
    if (hasChanged) {
      const message = `removed 0 values from mana cost for card ${card.id}`;
      messages.push(message);
      await cardService.saveCard(card);
      console.log(message);
    }
  }

  // Ensure that all cards reference art that exists
  const referencedArt = new Set<string>();
  for (const card of await cardService.getAllCards()) {
    for (const faceIndex in card.faces) {
      const face = card.faces[faceIndex];

      if (face.art && !existsSync(`${configuration.artDir}/${face.art}`)) {
        const message = `removed missing art for face ${faceIndex} of card ${card.id}: ${face.art}`;
        messages.push(message);
        delete face.art;
        await cardService.saveCard(card);
        console.log(message);
      }

      // Ensure that the art is not in the suggestions directory
      const art = await cardService.tryMoveArtSuggestionToArt(face, card.id);
      if (art !== face.art) {
        face.art = art;
        const message = `updated art for face ${faceIndex} of card ${card.id} to ${art}`;
        messages.push(message);
        await cardService.saveCard(card);
        console.log(message);
      }

      // Collect all referenced art
      if (art) {
        referencedArt.add(art);
      }
    }
  }

  // Validate that all art files in the art directory are referenced by at least one card
  const artFiles = await fs.readdir(configuration.artDir);
  for (const artFile of artFiles.filter(file => file.endsWith('.png'))) {
    if (!referencedArt.has(artFile)) {
      const message = `moved unreferenced art file to the suggestions directory: ${artFile}`;
      messages.push(message);
      // Move it to the suggestions directory
      await fs.mkdir(configuration.artSuggestionsDir, { recursive: true });
      await fs.rename(`${configuration.artDir}/${artFile}`, `${configuration.artSuggestionsDir}/${artFile}`);
      console.log(message);
    }
  }

  // Validate that deck/<deck> tags are numbers with values 0 or greater
  for (const card of await cardService.getAllCards()) {
    if (!card.tags) continue;

    let hasChanged = false;
    for (const tag of Object.keys(card.tags)) {
      if (tag.startsWith('deck/')) {
        const count = card.tags[tag];
        if (typeof count !== 'number' || count <= -1) {
          delete card.tags[tag];
          hasChanged = true;
          const message = `removed ${tag} tag with invalid count (${count}) for card ${card.id}`;
          messages.push(message);
          console.warn(message);
        }
      }
    }
    if (hasChanged) {
      await cardService.saveCard(card);
    }
  }

  console.info('Cleanup completed!');
  res.json({ message: 'Cleanup completed', details: messages });
});
