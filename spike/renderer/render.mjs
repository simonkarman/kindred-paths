// Phase 0 validation: prove the in-browser, same-origin CardConjurer render works AND that
// reloading the iframe fully resets state between cards (no autoFrame/frame-stack residue).
// Drives the demo UI (textarea -> renderFromInput) with two very different cards, saves each
// PNG, and asserts both are real renders that differ from each other.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFileSync, readdirSync } from 'node:fs';
import { startServer } from './serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const require = createRequire(join(REPO, 'server', 'package.json'));
const { chromium } = require('playwright');

const PORT = Number(process.env.PORT) || 4199;

function pngInfo(buf) {
  const isPng = buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50;
  return { isPng, width: isPng ? buf.readUInt32BE(16) : 0, height: isPng ? buf.readUInt32BE(20) : 0, bytes: buf.length };
}
const isRealRender = (i) => i.isPng && i.width >= 600 && i.height >= 800 && i.bytes > 20000;

async function main() {
  const art = readdirSync(join(REPO, 'collection/art')).find((f) => /\.(png|jpe?g)$/i.test(f));

  // Two deliberately different cards: a green creature (with art + PT) and a red instant
  // (no PT, no art, different frame). If the reload reset works, B shows a clean red instant
  // with no leftover green frame or power/toughness box from A.
  const cardA = {
    name: 'Spike Test Ranger',
    manaCost: '{2}{G}',
    typeLine: 'Creature — Elf Ranger',
    rules: 'Vigilance\nWhen Spike Test Ranger enters the battlefield, draw a card.',
    pt: '3/3',
    art: art ? `/local_art/${art}` : undefined,
    artist: 'Phase 0 Spike',
  };
  const cardB = {
    name: 'Bolt Test',
    manaCost: '{R}',
    typeLine: 'Instant',
    rules: 'Bolt Test deals 3 damage to any target.',
  };

  const server = await startServer(PORT);
  const browser = await chromium.launch({ headless: true });
  let ok = false;
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1400 } });
    page.on('console', (m) => console.log('  [page]', m.text()));
    page.on('pageerror', (e) => console.log('  [pageerror]', e.message));

    // ?noauto: don't auto-render the built-in sample, so our two renders are deterministic.
    await page.goto(`http://127.0.0.1:${PORT}/harness.html?noauto=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.renderFromInput === 'function');

    const renderCard = async (card, label) => {
      // Populate the textarea exactly as a user would, then trigger the demo's own flow.
      await page.evaluate((json) => { document.getElementById('cardJson').value = json; }, JSON.stringify(card, null, 2));
      const t0 = Date.now();
      const dataUrl = await page.evaluate(() => window.renderFromInput());
      if (!dataUrl) throw new Error(`${label}: renderFromInput returned null`);
      const buf = Buffer.from(dataUrl.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const outPath = join(HERE, `out-${label}.png`);
      writeFileSync(outPath, buf);
      const info = pngInfo(buf);
      console.log(`[render] ${label} (${card.name}): ${Date.now() - t0}ms`, info, '->', outPath);
      return { buf, info };
    };

    const a = await renderCard(cardA, 'a');
    const b = await renderCard(cardB, 'b');

    const differ = !a.buf.equals(b.buf);
    console.log('[render] A and B differ:', differ);
    ok = isRealRender(a.info) && isRealRender(b.info) && differ;
    console.log(ok
      ? '[render] PASS: two distinct cards rendered through the reload-reset flow'
      : '[render] FAIL: a render was blank or A and B were identical (reset may not work)');
  } catch (e) {
    console.error('[render] ERROR:', e);
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(ok ? 0 : 1);
}

main();
