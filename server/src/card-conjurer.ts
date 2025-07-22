import { chromium, Browser, Page } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';
import { Card } from 'kindred-paths';

export class CardConjurer {
  private browser: Browser | null;

  constructor(
    public readonly url: string
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
      headless: true,
    });
  }

  async renderCard(card: Card, set: { shortName: string, symbol: string, author: string }): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser is not started. Call start() first.');
    }

    try {
      const context = await this.browser.newContext({
        acceptDownloads: true
      });
      // Load the page
      const page = await context.newPage();
      await page.goto(this.url);
      await page.waitForLoadState('networkidle');
      await page.reload({ waitUntil: 'networkidle' });

      // Enable autoFrame
      await page.selectOption('#autoFrame', 'M15Regular-1');

      // Click on text section
      await page.click('#creator-menu-tabs h3:has-text("Text")');

      // Set the mana cost
      await page.click('#text-options h4:has-text("Mana Cost")');
      await page.fill('#text-editor', card.renderManaCost());
      await page.waitForLoadState('networkidle');

      // Set the name
      await page.click('#text-options h4:has-text("Title")', { force: true });
      const text_editor_name = page.locator('#text-editor');
      await text_editor_name.fill(card.name.slice(0, -1));
      await sleep(500);
      await text_editor_name.focus();
      await text_editor_name.pressSequentially(card.name.slice(-1));
      await page.waitForLoadState('networkidle');

      // Set the type line
      await page.click('#text-options h4:has-text("Type")');
      await page.fill('#text-editor', card.renderTypeLine());

      // Adjust type line width (if needed for a wide set symbol)
      // await page.click('#creator-menu-text button:has-text("Edit Bounds")');
      // await sleep(20);
      // await page.fill('#textbox-editor-width', '1400');
      // await sleep(20);
      // await page.click('#textbox-editor h2.textbox-editor-close');
      // await page.waitForLoadState('networkidle');

      // Set the rules text
      const rules_text = card.renderRules();
      const text_editor = page.locator('#text-editor');
      if (rules_text.length > 0) {
        await page.click('#text-options h4:has-text("Rules Text")');
        await text_editor.fill(rules_text.slice(0, -1));
        await sleep(1000);
        await text_editor.focus();
        await text_editor.pressSequentially(rules_text.slice(-1));
        await page.waitForLoadState('networkidle');

        // Adjust the rules text box size
        await page.click('#text-options h4:has-text("Rules Text")');
        await page.click('#creator-menu-text button:has-text("Edit Bounds")');
        await sleep(20);
        await page.fill('#textbox-editor-y', '1782');
        await page.fill('#textbox-editor-height', '798');
        await sleep(20);
        await page.click('#textbox-editor h2.textbox-editor-close');
        await page.waitForLoadState('networkidle');
      }

      // Set the power and toughness text
      if (card.pt !== undefined) {
        await page.click('#text-options h4:has-text("Power/Toughness")');
        await page.fill('#text-editor', card.pt.power + '/' + card.pt.toughness);
        await page.waitForLoadState('networkidle');
      }

      // Handle art section
      if (card.art !== undefined) {
        await page.click('#creator-menu-tabs h3:has-text("Art")');
        await page.waitForLoadState('networkidle');
        await page.fill('#creator-menu-art input[placeholder="Via URL"]', `local_art/${card.art}`);
        await page.fill('#creator-menu-art #art-artist', set.author);
        await page.waitForLoadState('networkidle');
      }

      // Handle symbol section
      await page.click('#creator-menu-tabs h3:has-text("Set Symbol")');
      await page.waitForLoadState('networkidle');
      await page.fill('#creator-menu-setSymbol #set-symbol-code', set.symbol);
      await page.fill('#creator-menu-setSymbol #set-symbol-rarity', card.rarity);
      await page.waitForLoadState('networkidle');

      // Handle collector section
      await page.click('#creator-menu-tabs h3:has-text("Collector")');
      await page.waitForLoadState('networkidle');
      await page.fill('#creator-menu-bottomInfo #info-number', ("0000" + card.collectorNumber.toString()).slice(-4));
      await page.fill('#creator-menu-bottomInfo #info-rarity', card.rarity[0].toUpperCase());
      await page.fill('#creator-menu-bottomInfo #info-set', set.shortName);
      await page.fill('#creator-menu-bottomInfo #info-language', 'EN');
      await page.fill('#creator-menu-bottomInfo #info-artist', set.author);
      await page.fill('#creator-menu-bottomInfo #info-year', new Date().getFullYear().toString());
      await page.waitForLoadState('networkidle');

      // Download the card
      await sleep(500); // Wait a bit for the image to load
      const [imgPage] = await Promise.all([
        context.waitForEvent('page'),
        page.click('#downloadAlt'),
      ]);
      await imgPage.waitForLoadState();
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
