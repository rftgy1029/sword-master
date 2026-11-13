import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { CARD_MOTIONS } from '../src/game/cardMotions.js';

const destination = fileURLToPath(new URL('../artifacts/combat-overhaul/', import.meta.url));
mkdirSync(destination, { recursive: true });
const base = process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:8175/';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 920 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('dev/three-preview.html', base).href);
  await page.locator('#scene-status').filter({ hasText: '장면 준비 완료' }).waitFor();
  const canvas = page.locator('canvas[data-renderer="three"]');
  const arena = page.locator('.preview-arena');
  const sample = (time) => canvas.evaluate((node, value) => node.__sword3d.sample(value), time);

  const frames = {
    strike: [0, 150, 330, 380, 400, 470, 680, 832],
    twin: [0, 160, 380, 420, 480, 600, 650, 710, 1100, 1252],
    nova: [0, 200, 570, 650, 745, 800, 875, 1120, 1580],
  };
  for (const [card, times] of Object.entries(frames)) {
    if (card === 'nova') {
      await page.getByRole('combobox', { name: '품질' }).selectOption('high');
      await page.waitForFunction(() => document.querySelector('canvas[data-renderer="three"]')?.__sword3d?.inspect().bloom);
    }
    await sample(times[0]);
    await page.locator(`[data-card-type="${card}"]`).click();
    for (const [index, time] of times.entries()) {
      if (index) await sample(time);
      await page.waitForFunction((at) => document.querySelector('canvas[data-renderer="three"]')
        ?.__sword3d?.inspect().elapsed === at, time);
      await arena.screenshot({ path: `${destination}${card}-${String(index).padStart(2, '0')}-${time}.png` });
    }
    assert.equal(await page.locator('#hit-status').textContent(), CARD_MOTIONS[card].hits.map((_, index) => `enemy:${index}`).join(','));
    await canvas.evaluate((node) => node.__sword3d.settle());
    await page.locator('#scene-status').filter({ hasText: '연출 완료' }).waitFor();
    console.log(`${card} ${times.length} frames`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
