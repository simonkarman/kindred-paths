import fs from 'fs/promises';
import { capitalize, Card, CardColor, CardFace, colorToShort, enumerate, hash, SerializedCard } from 'kindred-paths';
import { CardConjurer, Renderable } from '../card-conjurer';
import { computeCardId } from '../utils/card-utils';
import { configuration } from '../configuration';
import { symbolService } from './symbol-service';

export class RenderService {
  private cardConjurer: CardConjurer;

  constructor(cardConjurerUrl: string) {
    this.cardConjurer = new CardConjurer(cardConjurerUrl);
  }

  async start(): Promise<void> {
    await this.cardConjurer.start();
  }

  private async getExistingRender(key: string): Promise<Buffer | undefined> {
    try {
      const path = `${configuration.rendersCacheDir}/${key}.png`;
      return await fs.readFile(path);
    }
    catch {
      return undefined;
    }
  }

  private async saveRender(key: string, render: Buffer): Promise<void> {
    const path = `${configuration.rendersCacheDir}/${key}.png`;
    await fs.mkdir(configuration.rendersCacheDir, { recursive: true });
    await fs.writeFile(path, render);
  }

  async getRender(cardFace: CardFace, force: boolean): Promise<{ fromCache: boolean, render: Buffer }> {
    // If there is card art, use a hash of the image as the art property
    // This ensures the card will be rendered only if the art itself changes
    let artHash: string | undefined = undefined;
    if (cardFace.art) {
      try {
        const artBuffer = await fs.readFile(`${configuration.artDir}/${cardFace.art}`);
        artHash = hash(artBuffer.toString('base64'));
      } catch (error) {
        console.error(`Error reading art file ${cardFace.art}:`, error);
      }
    }

    // Get the set for the card
    const set = symbolService.getSetMetadataForCard(cardFace.card);
    // @ts-expect-error -- we don't want to send the theme to Card Conjurer
    delete set.theme;

    // Get layout info for MDFC cards
    let mdfc: Renderable['mdfc'] = undefined;
    if (cardFace.card.layout.id === 'modal') {
      const faceIndex = cardFace.card.faces.indexOf(cardFace);
      const otherFace = cardFace.card.faces[faceIndex === 0 ? 1 : 0];
      const side = faceIndex === 0 ? 'front' : 'back';

      if (otherFace.types.includes('land')) {
        const producibleColors = otherFace.producibleColors();
        mdfc = {
          side,
          otherFrameColor: 'l',
          otherCardType: 'Land',
          otherText: `{t}: Add ${enumerate(producibleColors.map(c => c === 'colorless' ? '{c}' : `{${colorToShort(c)}}`), { lastSeparator: 'or' })}`,
        };
      } else {
        const ptPrefix = otherFace.pt ? `${otherFace.pt.power}/${otherFace.pt.toughness} ` : '';
        const otherFrameColor = [
          () => (otherFace.types.includes('artifact')
            ? 'a' as const
            : 'l' as const
          ),
          (c: CardColor[]) => colorToShort(c[0]),
          () => 'm' as const,
        ][Math.min(otherFace.color().length, 2)](otherFace.color());
        mdfc = {
          side,
          otherFrameColor: otherFrameColor,
          otherCardType: ptPrefix + (otherFace.subtypes.length > 0
            ? capitalize(otherFace.subtypes[0])
            : capitalize(otherFace.types[otherFace.types.length - 1])),
          otherText: otherFace.renderManaCost(),
        };
      }
    }
    let adventure: Renderable['adventure'] = undefined;
    if (cardFace.card.layout.id === 'adventure') {
      if (cardFace.faceIndex === 1) {
        throw new Error('adventure back faces cannot be rendered alone');
      }
      const adventureFace = cardFace.card.faces[1];
      adventure = {
        manaCost: adventureFace.renderManaCost(),
        title: adventureFace.name,
        type: adventureFace.renderTypeLine(),
        rules: adventureFace.renderRules(),
        color: adventureFace.color(),
      };
    }
    let transform: Renderable['transform'] = undefined;
    if (cardFace.card.layout.id === 'transform') {
      if (cardFace.faceIndex === 0) {
        const otherPt = cardFace.card.faces[1].pt;
        transform = { side: 'front', flipText: otherPt ? `${otherPt.power}/${otherPt.toughness}` : '' };
      } else {
        transform = { side: 'back' };
      }
    }

    // Prepare renderable object
    const renderable: Renderable = {
      name: cardFace.name,
      isToken: cardFace.card.isToken,
      manaCost: cardFace.renderManaCost(),
      color: cardFace.color(),
      producibleColors: cardFace.producibleColors(),
      typeLine: cardFace.renderTypeLine(),
      types: cardFace.types,
      subtypes: cardFace.subtypes,
      supertype: cardFace.supertype,
      hasRules: cardFace.rules.length > 0,
      rules: cardFace.renderRules(),
      pt: cardFace.pt,
      loyalty: cardFace.loyalty,
      loyaltyAbilities: cardFace.loyaltyAbilities(),
      art: cardFace.art,
      tags: {
        borderless: cardFace.card.getTagAsString('borderless') === 'true' || cardFace.card.tags['borderless'] === true,
        'fs/rules': cardFace.card.getTagAsNumber('fs/rules'),
        'art/focus': cardFace.card.getTagAsString('art/focus'),
      },
      rarity: cardFace.card.rarity,
      collectorNumber: cardFace.card.collectorNumber,
      set, // TODO: Add 'set-symbol art' hash, to rerender if 'set-symbol art' changes
      mdfc,
      adventure,
      transform,
    };

    // Create a unique key for the renderable object and the content of the art file
    const key = hash(JSON.stringify({
      ...renderable,
      art: artHash,
    }));

    if (!force) {
      // Check if the render already exists
      const existingRender = await this.getExistingRender(key);
      if (existingRender) {
        console.info(`Returning cached render for "${cardFace.name}" (${key})`);
        return { fromCache: true, render: existingRender };
      }
    }

    // If not, render the card using Card Conjurer
    const startTime = Date.now();
    console.info(`Starting render for "${cardFace.name}" (${key})`);
    const render = await this.cardConjurer.renderCard(renderable);
    const elapsedTime = Date.now() - startTime;
    console.info(`Render completed for "${cardFace.name}" (${key}) in ${(elapsedTime / 1000).toFixed(1)} seconds`);
    await this.saveRender(key, render);
    return { fromCache: false, render };
  }

  async generatePreview(cardData: SerializedCard, faceIndex: number): Promise<{ render: Buffer, fromCache: boolean }> {
    const card = new Card(cardData);
    const { render, fromCache } = await this.getRender(card.faces[faceIndex], false);

    // Save the card json to the previews directory
    if (!fromCache) {
      const previewId = `${new Date().toISOString()}-${computeCardId(card.toJson())}`;
      const previewPath = `${configuration.previewsCacheDir}/${previewId}.json`;
      await fs.mkdir(configuration.previewsCacheDir, { recursive: true });
      await fs.writeFile(previewPath, JSON.stringify(card.toJson(), null, 2), 'utf-8');
    }

    return { render, fromCache };
  }
}

export const renderService = new RenderService(process.env.CARD_CONJURER_URL || 'http://localhost:4102');
