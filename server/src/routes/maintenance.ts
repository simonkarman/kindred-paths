import { Router } from 'express';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { cardService } from '../services/card-service';
import { configuration } from '../configuration';
import { mechanicsService } from '../services/mechanics-service';
import { AutoReminderText, computeCardId } from 'kindred-paths';

export const maintenanceRouter = Router();

maintenanceRouter.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

maintenanceRouter.post('/cleanup', async (_, res) => {
  const messages: string[] = [];
  console.info('Cleanup requested...');

  // Abort if not cards can be found
  if ((await cardService.getAllCards()).length === 0) {
    const message = 'aborting cleanup because no cards could be found';
    messages.push(message);
    console.warn(message);
    res.json({ message: 'Cleanup aborted', details: messages });
    return;
  }

  // Save each card to ensure consistent formatting
  for (const card of await cardService.getAllCards()) {
    await cardService.saveCard(card);
  }

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
  for (const artFile of artFiles.filter(file => ['.png', '.jpg', '.jpeg', '.webp'].some(ext => file.endsWith(ext)))) {
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

  // Validate that all cards that use reminder text for keywords, match their template
  const mechanics = await mechanicsService.getAllMechanics();
  const autoReminderText = new AutoReminderText(mechanics.keywords);
  for (const card of await cardService.getAllCards()) {
    let hasChanged = false;
    card.faces.forEach((face, faceIndex) => {
      face.rules?.forEach((rule, index) => {
        if (rule.variant === 'inline-reminder') {
          const previousRule = index === 0 ? undefined : face.rules?.[index - 1];
          // console.info('Checking inline-reminder', { cardId: card.id, faceIndex, rule, previousRule });
          if (previousRule?.variant === 'keyword') {
            const auto = autoReminderText.for(previousRule.content);
            if (auto && auto !== rule.content) {
              const message = `inline-reminder for keyword "${previousRule.content}" on card ${card.id} face ${faceIndex} does not` +
                  `match the template (it is "${rule.content}" but should be "${auto}")`;
              messages.push(message);
              console.log(message);
            }
          }
        }
        if (rule.variant === 'ability' && autoReminderText.for(rule.content) !== undefined) {
          rule.variant = 'keyword';
          rule.content = rule.content.toLowerCase();
          hasChanged = true;
          const message = `ability rule on card ${card.id} face ${faceIndex} matches a keyword template ("${rule.content}"), `
             + 'consider changing it to a keyword rule';
          messages.push(message);
          console.log(message);
        }
      });
    });
    if (hasChanged) {
      await cardService.saveCard(card);
    }
  }

  console.info('Cleanup completed!');
  res.json({ message: 'Cleanup completed', details: messages });
});
