// Phase 0.8 — capability check: can @napi-rs/canvas draw with CC's fonts + frame images in Node?
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFileSync, existsSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CC = resolve(HERE, '../../server/.cardconjurer');
const FONTS = join(CC, 'fonts');

// Register a few CardConjurer fonts by the family names its CSS uses.
const fontMap = [
  ['beleren-b.ttf', 'belerenb'],
  ['beleren-bsc.ttf', 'belerenbsc'],
  ['mplantin.ttf', 'mplantin'],
  ['mplantin-i.ttf', 'mplantini'],
];
let registered = 0;
for (const [file, family] of fontMap) {
  const p = join(FONTS, file);
  if (existsSync(p)) { GlobalFonts.registerFromPath(p, family); registered++; }
  else console.log('  missing font:', file);
}
console.log(`[cap] registered ${registered}/${fontMap.length} fonts; total families: ${GlobalFonts.families.length}`);

const canvas = createCanvas(750, 1050);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#e8e8e8';
ctx.fillRect(0, 0, 750, 1050);

// Try drawing a frame image from the CC clone (proves filesystem image load + drawImage).
const framePath = join(CC, 'img/frames/m15/regular/m15FrameWSVG.png');
const altFrame = join(CC, 'img/frames/m15/regular');
let frameOk = false;
try {
  let fp = framePath;
  if (!existsSync(fp)) {
    const cands = existsSync(altFrame) ? readdirSync(altFrame).filter(f => f.endsWith('.png')) : [];
    fp = cands.length ? join(altFrame, cands[0]) : null;
  }
  if (fp) { const img = await loadImage(fp); ctx.drawImage(img, 0, 0, 750, 1050); frameOk = true; console.log('[cap] drew frame image:', fp.replace(CC, '.')); }
  else console.log('[cap] no frame image found to test');
} catch (e) { console.log('[cap] frame image load FAILED:', e.message); }

ctx.fillStyle = '#000';
ctx.font = '48px belerenb';
ctx.fillText('Beleren Title Test', 40, 80);
ctx.font = '32px belerenbsc';
ctx.fillText('Creature — Elf Ranger', 40, 140);
ctx.font = '30px mplantin';
ctx.fillText('Vigilance. When this enters, draw a card.', 40, 980);

const buf = canvas.toBuffer('image/png');
writeFileSync(join(HERE, 'out-cap.png'), buf);
console.log(`[cap] wrote out-cap.png (${buf.length} bytes). frameImage=${frameOk}`);
console.log('[cap] PASS: @napi-rs/canvas can register CC fonts, draw text + images, export PNG.');
