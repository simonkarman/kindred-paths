import { Browser, chromium, Page } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';
import {
  capitalize,
  CardColor,
  CardColorCharacter,
  CardSuperType,
  CardType,
  colorToShort,
  landSubtypeToColor,
  LoyaltyCost,
  TokenCardType,
} from 'kindred-paths';
import { computePlaneswalkerData } from './utils/compute-planeswalker-data';

export type FrameColor = CardColorCharacter | 'a' | 'l' | 'm';
type ModalFrameColor = CardColorCharacter | `${CardColorCharacter}l` | 'l' | 'm' | 'ml' | 'a' | 'v';
type PowerToughnessColor = CardColorCharacter | 'm' | 'a' | 'v';

const getModalFrameColors = (_color: CardColor[], isLand: boolean): [ModalFrameColor, ModalFrameColor | undefined] => {
  const color = _color.map(c => colorToShort(c));

  // Colorless
  if (color.length === 0) return [isLand ? 'l' : 'a', undefined];

  // Single color
  const leftColor: ModalFrameColor = isLand ? `${color[0]}l` : color[0];
  if (color.length === 1) {
    return [leftColor, undefined];
  }

  // Dual color
  if (color.length === 2) {
    const rightColor: ModalFrameColor = isLand ? `${color[0]}l` : color[0];
    return [leftColor, rightColor];
  }

  // Multi color
  return [isLand ? 'ml' : 'm', undefined];
};

const getPowerToughnessColor = (color: CardColor[], isVehicle: boolean): PowerToughnessColor => {
  if (isVehicle) {
    return 'v';
  }
  if (color.length === 0) return 'a';
  if (color.length === 1) return colorToShort(color[0]);
  return 'm';
};

export type Renderable = {
  name: string,
  isToken?: true,
  manaCost: string,
  color: CardColor[],
  predefinedColors?: CardColor[],
  typeLine: string,
  types: [CardType, ...CardType[]],
  subtypes: string[],
  supertype: CardSuperType,
  hasRules: boolean,
  rules: string,
  pt?: { power: number, toughness: number },
  loyalty?: number,
  loyaltyAbilities?: { cost: LoyaltyCost, content: string }[],
  art?: string,
  tags: {
    borderless?: boolean,
    'fs/rules'?: number,
    'art/focus'?: string,
  },
  rarity: string,
  collectorNumber: number,
  set: {
    author: string,
    symbol?: string,
    collectorNumberOffset?: number,
    shortName: string,
  },
  mdfc?: {
    side: 'front' | 'back',
    otherFrameColor: FrameColor,
    otherCardType: string,
    otherText: string,
  }
}

export class CardConjurer {
  private browser: Browser | null;
  private isDebuggingMode = false;

  constructor(
    public readonly url: string,
  ) {
    this.browser = null;
  }

  async start(): Promise<void> {
    // Validate that Card Conjurer is running
    const result = await fetch(this.url);
    if (result.status !== 200) {
      throw new Error(`Card Conjurer is not running at ${this.url}`);
    }
    const response = await result.text();
    if (!response.includes("<h1 class='title center'>CARD CONJURER</h1>")) {
      throw new Error(`Card Conjurer did not respond with expected content at ${this.url}`);
    }

    // Create headless browser instance
    this.browser = await chromium.launch({
      headless: !this.isDebuggingMode,
    });
  }

  async renderCard(renderable: Renderable): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser is not started. Call start() first.');
    }

    try {
      const context = await this.browser.newContext({
        acceptDownloads: true,
      });
      // Load the page
      const page = await context.newPage();
      await page.goto(this.url);
      await page.waitForLoadState('networkidle');
      await page.reload({ waitUntil: 'networkidle' });

      // Compute planeswalker data (if applicable)
      const planeswalkerData = computePlaneswalkerData(renderable);

      // Handle the frame section
      let forceTitleColorToBlack = false;
      let isFullArt = false;
      if (renderable.mdfc) {
        // Select frame pack
        await page.selectOption('#autoFrame', 'false');
        await page.selectOption('#selectFrameGroup', 'Modal-1');
        const framePack = 'ModalRegular';
        await page.selectOption('#selectFramePack', framePack);
        await sleep(50);
        await page.click('#loadFrameVersion');

        // Gather MDFC information
        const side = renderable.mdfc.side;
        const [left, right] = getModalFrameColors(renderable.color, renderable.types.includes('land'));
        const overlayMulticolor = right !== undefined;
        const overlayVehicleFrame = renderable.subtypes.includes('vehicle');
        const ptColor: PowerToughnessColor | undefined = renderable.pt
          ? getPowerToughnessColor(renderable.color, renderable.subtypes.includes('vehicle'))
          : undefined;
        const otherFrameColor: FrameColor = renderable.mdfc.otherFrameColor;

        const addFrameImage = async (
          image: string,
          options?: {
            mask?: string,
            placement?: 'addToFull' | 'addToRightHalf',
          },
        ) => {
          await page.click(`div.frame-option:has(img[src="/img/frames/${image}Thumb.png"])`);
          if (options?.mask) {
            await page.click(`div.mask-option:has-text("${options.mask}")`);
          }
          const placement = options?.placement ?? 'addToFull';
          await page.click(`#${placement}`);
          await sleep(50);
        };

        // Add frames
        await addFrameImage(`modal/regular/${side === 'back' ? 'back/' : ''}${left}`);
        if (right) {
          await addFrameImage(`modal/regular/${side === 'back' ? 'back/' : ''}${right}`, { placement: 'addToRightHalf' });
        }
        if (overlayMulticolor) {
          const m = `modal/regular/${side === 'back' ? 'back/' : ''}${renderable.types.includes('land') ? 'ml' : 'm'}`;
          await addFrameImage(m, { mask: 'Title' });
          await addFrameImage(m, { mask: 'Type' });
          await addFrameImage(m, { mask: 'Frame' });
        }
        if (overlayVehicleFrame) {
          await addFrameImage(`modal/regular/${side === 'back' ? 'back/' : ''}v`, { mask: 'Frame' });
        }
        if (ptColor) {
          await addFrameImage(`m15/${side === 'back' ? 'transform/regular/pt' : 'regular/m15PT'}${ptColor.toUpperCase()}`);
        }
        await addFrameImage(`modal/regular/${side === 'back' ? 'back/' : ''}${otherFrameColor}`, { mask: 'Flipside' });

      } else if (renderable.isToken) {
        // Gather token information
        const tokenType = renderable.hasRules ? 'Regular' : 'Textless';
        const predefinedColors = renderable.predefinedColors ?? [];
        const numberOfColors = predefinedColors.length;
        const dominantCardType = (renderable.types[renderable.types.length - 1]) as TokenCardType;
        const frameColor = numberOfColors === 0
          ? ({ 'creature': 'C', 'artifact': 'A', 'enchantment': 'C', 'land': 'L' }[dominantCardType])
          : (numberOfColors > 1 ? 'M' : colorToShort(predefinedColors[0]).toUpperCase());
        const frameName = frameColor === 'C' ? 'frameCThumb' : `tokenFrame${frameColor}${tokenType}Thumb`;
        if (frameColor === 'W') {
          forceTitleColorToBlack = true;
        }
        isFullArt = true;

        // Select frame pack
        await page.selectOption('#autoFrame', 'false');
        await page.selectOption('#selectFrameGroup', 'Token-2');
        const framePack = `Token${tokenType}-1`;
        await page.selectOption('#selectFramePack', framePack);
        await sleep(50);
        await page.click('#loadFrameVersion');

        // Select frame image
        const frameImage = `/img/frames/token/${tokenType.toLowerCase()}/${frameName}.png`;
        await page.click(`div.frame-option:has(img[src="${frameImage}"])`);
        await page.click('#addToFull');
        await sleep(50);

        // Select PT image
        if (renderable.pt) {
          const ptImage = `/img/frames/m15/regular/m15PT${frameColor}Thumb.png`;
          await page.click(`div.frame-option:has(img[src="${ptImage}"])`);
          await page.click('#addToFull');
          await sleep(50);
        }
      } else if (planeswalkerData) {
        // Select frame pack
        await page.selectOption('#autoFrame', 'false');
        await page.selectOption('#selectFrameGroup', 'Planeswalker');
        await page.selectOption('#selectFramePack', `Planeswalker${capitalize(planeswalkerData.size)}`);
        await sleep(50);
        await page.click('#loadFrameVersion');

        // Select frame image
        const getFrameColors = (cardColor: CardColor[]): [string] | [string, string] => {
          if (cardColor.length === 0) return ['A'];
          if (cardColor.length === 1) return [colorToShort(cardColor[0]).toUpperCase()];
          if (cardColor.length === 2) return [colorToShort(cardColor[0]).toUpperCase(), colorToShort(cardColor[1]).toUpperCase()];
          return ['M'];
        };
        const [frameColorLeft, frameColorRight] = getFrameColors(renderable.color);
        const addFrame = async (frameColor: string, placement: 'addToFull' | 'addToRightHalf' = 'addToFull') => {
          const frameName = planeswalkerData.size === 'tall' ? 'Tall' : 'Frame';
          const frameImage = `/img/frames/planeswalker/${planeswalkerData.size}/planeswalker${frameName}${frameColor}Thumb.png`;
          await page.click(`div.frame-option:has(img[src="${frameImage}"])`);
          await page.click(`#${placement}`);
          await sleep(50);
        };
        await addFrame(frameColorLeft);
        if (frameColorRight) {
          await addFrame(frameColorRight, 'addToRightHalf');
        }
        isFullArt = true;
      } else {
        // Enable autoFrame
        await page.selectOption('#autoFrame', renderable.tags.borderless ? 'Borderless' : 'M15RegularNew');
      }

      // Click on text section
      await page.click('#creator-menu-tabs h3:has-text("Text")');

      // Set the mana cost
      await page.click('#text-options h4:has-text("Mana Cost")');
      await page.fill('#text-editor', renderable.manaCost);
      await page.waitForLoadState('networkidle');

      // Set the name
      await page.click('#text-options h4:has-text("Title")', { force: true });
      const text_editor_name = page.locator('#text-editor');
      const title = (forceTitleColorToBlack ? '{fontcolor#000000}' : '') + renderable.name;
      await text_editor_name.fill(title.slice(0, -1));
      await sleep(500);
      await text_editor_name.focus();
      await text_editor_name.pressSequentially(title.slice(-1));
      await page.waitForLoadState('networkidle');

      // Set MDFC text if applicable
      if (renderable.mdfc) {
        await page.click('#text-options h4:has-text("Flipside Type")', { force: true });
        await page.fill('#text-editor', renderable.mdfc.otherCardType);
        await page.waitForLoadState('networkidle');

        await page.click('#text-options h4:has-text("Flipside Text")', { force: true });
        await page.fill('#text-editor', renderable.mdfc.otherText);
        await page.waitForLoadState('networkidle');
      }

      // Set the type line
      await page.click('#text-options h4:has-text("Type")');
      const text_editor_type_line = page.locator('#text-editor');
      const typeLine = renderable.typeLine;
      await text_editor_type_line.fill(typeLine.slice(0, -1));
      await sleep(500);
      await text_editor_type_line.focus();
      await text_editor_type_line.pressSequentially(typeLine.slice(-1));
      await page.waitForLoadState('networkidle');

      // Adjust type line width (if needed for a wide set symbol)
      // await page.click('#creator-menu-text button:has-text("Edit Bounds")');
      // await sleep(20);
      // await page.fill('#textbox-editor-width', '1400');
      // await sleep(20);
      // await page.click('#textbox-editor h2.textbox-editor-close');
      // await page.waitForLoadState('networkidle');

      if (planeswalkerData) {
        // Set the loyalty text
        await page.click('#text-options h4:has-text("Loyalty")');
        const text_editor_loyalty = page.locator('#text-editor');
        await text_editor_loyalty.fill(renderable.loyalty!.toString());
        await sleep(50);
        await page.waitForLoadState('networkidle');

        // Set the abilities texts
        for (let abilityIndex = 0; abilityIndex < planeswalkerData.abilities.length; abilityIndex++) {
          const { content } = planeswalkerData.abilities[abilityIndex];
          await page.click(`#text-options h4:has-text("Ability ${abilityIndex + 1}")`);
          const text_editor_ability = page.locator('#text-editor');
          await text_editor_ability.fill(content.slice(0, -1));
          await sleep(50);
          await text_editor_ability.focus();
          await text_editor_ability.pressSequentially(content.slice(-1));
          await page.waitForLoadState('networkidle');

          // Adjust the font size if specified
          await page.fill('#text-editor-font-size', planeswalkerData.rulesFontSize.toString());
        }

        // Set the ability boxes
        await page.click('#creator-menu-tabs h3:has-text("Planeswalker")');
        await page.waitForLoadState('networkidle');
        type Shift = { regular: number, tall: number };
        const shiftPerNumberOfAbilities: [[Shift], [Shift, Shift], [Shift, Shift, Shift], [Shift, Shift, Shift, Shift]] = [
          [{ regular: 364, tall: 474 }],
          [{ regular: 220, tall: 246 }, { regular: 574, tall: 702 }],
          [{ regular: 132, tall: 132 }, { regular: 364, tall: 474 }, { regular: 616, tall: 816 }],
          [{ regular: 94, tall: 132 }, { regular: 289, tall: 360 }, { regular: 487, tall: 588 }, { regular: 686, tall: 816 }],
        ];
        for (let abilityIndex = 0; abilityIndex < 4; abilityIndex++) {
          let height = 0, cost = '', shift = 0;
          if (abilityIndex < planeswalkerData.abilities.length) {
            const ability = planeswalkerData.abilities[abilityIndex];

            height = ability.height;
            cost = ability.cost;
            shift = -shiftPerNumberOfAbilities[planeswalkerData.abilities.length - 1][abilityIndex][planeswalkerData.size]
              + (height / 2)
              + ability.startHeight - 5;
          }
          await page.fill(`#planeswalker-height-${abilityIndex}`, height.toFixed());
          await page.fill(`#planeswalker-cost-${abilityIndex}`, cost);
          await page.fill(`#planeswalker-shift-${abilityIndex}`, shift.toFixed());
          await sleep(20);
        }
      } else {
        // Set the rules text
        const rules_text = renderable.rules;
        if (rules_text.length > 0) {
          await page.click('#text-options h4:has-text("Rules Text")');
          const text_editor_rules = page.locator('#text-editor');
          await text_editor_rules.fill(rules_text.slice(0, -1));
          await sleep(1000);
          await text_editor_rules.focus();
          await text_editor_rules.pressSequentially(rules_text.slice(-1));
          await page.waitForLoadState('networkidle');

          // Adjust the rules text box size
          if (!renderable.isToken) {
            await page.click('#text-options h4:has-text("Rules Text")');
            await page.click('#creator-menu-text button:has-text("Edit Bounds")');
            await sleep(20);
            await page.fill('#textbox-editor-y', '1782');
            await page.fill('#textbox-editor-height', renderable.mdfc ? '705' : '798');
            await sleep(20);
            await page.click('#textbox-editor h2.textbox-editor-close');
            await page.waitForLoadState('networkidle');
          }

          // Adjust the font size if specified
          const rulesFontSize = typeof renderable.tags?.['fs/rules'] === 'number' ? renderable.tags['fs/rules'] : 0;
          if (rulesFontSize !== 0) {
            await page.fill('#text-editor-font-size', rulesFontSize.toString());
          }
        }

        // Set the power and toughness text
        if (renderable.pt !== undefined) {
          await page.click('#text-options h4:has-text("Power/Toughness")');
          const isArtifactVehicle = renderable.types.includes('artifact') && renderable.subtypes.includes('vehicle');
          const prefix = !renderable.isToken && isArtifactVehicle ? '{fontcolor#fff}' : '';
          await page.fill('#text-editor', prefix + renderable.pt.power + '/' + renderable.pt.toughness);
          await page.waitForLoadState('networkidle');
        }
      }

      // If basic land, add the icon for the land type to the frame
      if (renderable.supertype === 'basic' && renderable.types.includes('land') && renderable.rules.length === 0) {
        await page.click('#creator-menu-tabs h3:has-text("Frame")');
        await page.waitForLoadState('networkidle');

        // Select frame pack
        await page.selectOption('#selectFrameGroup', 'Regular');
        await page.selectOption('#selectFramePack', 'Lands');
        await sleep(500);

        const landColor = colorToShort(landSubtypeToColor(renderable.subtypes[0]) ?? 'white');
        const landIconImage = `/img/frames/m15/basics/${landColor}Thumb.png`;
        await page.click(`div.frame-option:has(img[src="${landIconImage}"])`);
        await page.click('#addToFull');
        await sleep(500);
        await page.waitForLoadState('networkidle');
      }

      // Handle art section
      if (renderable.art) {
        await page.click('#creator-menu-tabs h3:has-text("Art")');
        await page.waitForLoadState('networkidle');
        await page.fill('#creator-menu-art input[placeholder="Via URL"]', renderable.art);
        await page.fill('#creator-menu-art #art-artist', renderable.set.author);
        await page.waitForLoadState('networkidle');

        // Set card x,y,zoom,rotate when full art
        if (isFullArt) {
          await sleep(100);
          const focusAreas = planeswalkerData ? {
            // for planeswalkers
            'zoom-0': { x: -255, y: 80, zoom: 164 },
            'zoom-1': { x: -280, y: -50, zoom: 170 },
            'zoom-2': { x: -500, y: -250, zoom: 200 },
          } : {
            // for non-planeswalkers
            'zoom-0': { x: -254, y: 80, zoom: 164 },
            'zoom-1': { x: -300, y: 60, zoom: 170 },
            'zoom-2': { x: -503, y: -50, zoom: 200 },
          };
          const _focus = renderable.tags['art/focus'] ?? 'zoom-0';
          const focusAreaName = _focus in focusAreas ? _focus as keyof typeof focusAreas : 'zoom-0';
          const focusArea = focusAreas[focusAreaName];
          await page.fill('#art-x', focusArea.x.toFixed());
          await page.fill('#art-y', focusArea.y.toFixed());
          await page.fill('#art-zoom', focusArea.zoom.toFixed(1));
          await page.waitForLoadState('networkidle');
        }
      }

      // Handle symbol section
      if (renderable.set.symbol) {
        await page.click('#creator-menu-tabs h3:has-text("Set Symbol")');
        await page.waitForLoadState('networkidle');
        await page.fill('#creator-menu-setSymbol #set-symbol-code', renderable.set.symbol);
        await page.fill('#creator-menu-setSymbol #set-symbol-rarity', renderable.rarity);
        await page.waitForLoadState('networkidle');
      }

      // Handle collector section
      await page.click('#creator-menu-tabs h3:has-text("Collector")');
      await page.waitForLoadState('networkidle');
      const collectorNumber = renderable.collectorNumber - (renderable.set.collectorNumberOffset ?? 0);
      await page.fill('#creator-menu-bottomInfo #info-number', ('0000' + collectorNumber.toString()).slice(-4));
      await page.fill('#creator-menu-bottomInfo #info-rarity', renderable.rarity[0].toUpperCase());
      await page.fill('#creator-menu-bottomInfo #info-set', renderable.set.shortName);
      await page.fill('#creator-menu-bottomInfo #info-note', new Date().toISOString().split('T')[0]);
      await page.fill('#creator-menu-bottomInfo #info-language', 'EN');
      await page.fill('#creator-menu-bottomInfo #info-artist', renderable.set.author);
      await page.fill('#creator-menu-bottomInfo #info-year', new Date().getFullYear().toString());
      await page.click('label:has(#enableNewCollectorStyle)');
      await page.waitForLoadState('networkidle');

      // Wait in debugging mode
      if (this.isDebuggingMode) {
        await sleep(15000);
      }

      // Download the card
      await sleep(500); // Wait a bit for the image to load
      const [imgPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('#downloadAlt'),
      ]);
      await imgPage.waitForLoadState();
      await sleep(500); // Wait a bit more for the image to load
      const buffer = await getBase64Image(imgPage);

      // Close the context
      await context.close();

      return buffer;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}

async function getBase64Image(page: Page): Promise<Buffer> {
  // Get the base64 string from the image src
  const base64String = await page.$eval('img', (img) => {
    const src = img.getAttribute('src') || '';
    console.info(src);
    // Remove the data URL prefix to get just the base64 string
    return src.replace(/^data:image\/\w+;base64,/, '');
  });

  // Convert base64 to buffer
  return Buffer.from(base64String, 'base64');
}
