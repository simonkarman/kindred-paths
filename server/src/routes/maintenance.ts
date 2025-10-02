import { Router } from 'express';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { Card } from 'kindred-paths';
import { cardService } from '../services/card-service';
import { computeCardId } from '../utils/card-utils';

export const maintenanceRouter = Router();

maintenanceRouter.post('/cleanup', async (req, res) => {
  const messages: string[] = [];
  console.info("Cleanup requested...");

  // Rename cards that have an ID different from the computed ID based on their name
  for (const card of await cardService.getAllCards()) {
    const cardId = computeCardId(card);
    if (card.id !== cardId) {
      // check that the new cardId does not already exist
      const existingCard = await cardService.getCardById(cardId);
      if (existingCard) {
        const message = `skipped renaming card ${card.id} to ${cardId} because it already exists`;
        messages.push(message);
        console.warn(message);
        continue;
      }

      const message = `renamed card ${card.id} to ${cardId}`;
      messages.push(message);
      await fs.rename(`./cards/${card.id}.json`, `./cards/${cardId}.json`);
      console.log(message);
    }
  }

  // Ensure all keywords are lowercase
  for (const card of await cardService.getAllCards()) {
    if (!card.rules) continue;

    let hasChanged = false;
    card.rules = card.rules.map(rule => {
      if (rule.variant === 'keyword') {
        const content = rule.content.toLowerCase();
        if (rule.content !== content) {
          hasChanged = true;
        }
        return { ...rule, content, };
      }
      return rule;
    });
    if (hasChanged) {
      const message = `updated keywords to lowercase for card ${card.id}`;
      messages.push(message);
      await cardService.saveCard(new Card(card));
      console.log(message);
    }
  }

  // Ensure that 0 values in the mana cost are removed
  for (const card of await cardService.getAllCards()) {
    if (!Object.values(card.manaCost).includes(0)) {
      continue; // No 0 values to remove
    }

    // Create a new mana cost object without 0 values
    const newManaCost: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(card.manaCost)) {
      if (value !== 0) {
        newManaCost[key] = value;
      }
    }

    // Update the card with the new mana cost
    card.manaCost = newManaCost;
    const message = `removed 0 values from mana cost for card ${card.id}`;
    messages.push(message);
    await cardService.saveCard(new Card(card));
    console.log(message);
  }

  // Ensure that all cards reference art that exists
  const referencedArt = new Set<string>();
  for (const card of await cardService.getAllCards()) {
    if (card.art && !existsSync(`./art/${card.art}`)) {
      const message = `removed missing art for card ${card.id}: ${card.art}`;
      messages.push(message);
      delete card.art;
      await cardService.saveCard(new Card(card));
      console.log(message);
    }

    // Ensure that the art is not in the suggestions directory
    const art = await tryMoveArtSuggestionToArt(card);
    if (art !== card.art) {
      const message = `updated art for card ${card.id} to ${art}`;
      messages.push(message);
      await cardService.saveCard(new Card({ ...card, art }));
      console.log(message);
    }

    // Collect all referenced art
    if (art) {
      referencedArt.add(art);
    }
  }

  // Validate that all art files in the art directory are referenced by at least one card
  const artFiles = await fs.readdir('./art');
  for (const artFile of artFiles.filter(file => file.endsWith('.png'))) {
    if (!referencedArt.has(artFile)) {
      const message = `moved unreferenced art file to the suggestions directory: ${artFile}`;
      messages.push(message);
      // Move it to the suggestions directory
      await fs.mkdir('./art/suggestions', { recursive: true });
      await fs.rename(`./art/${artFile}`, `./art/suggestions/${artFile}`);
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
      await cardService.saveCard(new Card(card));
    }
  }

  console.info("Cleanup completed!");
  res.json({ message: 'Cleanup completed', details: messages });
});

async function tryMoveArtSuggestionToArt(card: any): Promise<string | undefined> {
  if (card.art && card.art.startsWith('suggestions/')) {
    try {
      await fs.mkdir('./art', { recursive: true });
      const from = `./art/${card.art}`;
      const toFileName = card.art.replace('suggestions/', '');
      const to = `./art/${toFileName}`;
      await fs.rename(from, to);
      console.log(`Moved new art from ${from} to ${to}`);
      return toFileName;
    } catch (error) {
      console.error(`Error moving new art for card ${card.id}:`, error);
    }
  }
  return card.art;
}
