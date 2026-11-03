import { test, expect } from '@playwright/test';
import { banks } from '../../src/data/words.ts';

test('desktop: start, answer, summon, pause, resume, and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page).toHaveTitle('단어 수비대 · WORD PAWS');
  await expect(page.locator('#options button')).toHaveCount(4);
  await expect(page.locator('#pause')).toBeDisabled();
  await page.locator('#start').click();
  await expect(page.locator('#overlay')).toBeHidden();

  const word = await page.locator('#word').innerText();
  const meaning = banks.basic.find(w => w[0] === word)![1];
  await page.locator('#options').getByRole('button', { name: meaning }).click();
  await expect(page.locator('#feedback')).toContainText('정답! +55');
  await expect(page.locator('#record')).toHaveText('정답 1 / 1');
  await page.locator('#unit2').click();
  await expect(page.locator('#unit2')).toBeDisabled();
  const energy = Number((await page.locator('#energy').innerText()).split(' ')[0]);
  expect(energy).toBeGreaterThanOrEqual(35);
  expect(energy).toBeLessThan(50);

  await page.keyboard.press('p');
  await expect(page.locator('#overlayTitle')).toHaveText('잠깐, 쉬어가요.');
  const time = await page.locator('#battleTime').innerText();
  await page.waitForTimeout(1100);
  await expect(page.locator('#battleTime')).toHaveText(time);
  await page.locator('#start').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.screenshot({ path: 'test-results/word-paws-desktop.png', fullPage: true });
  await page.locator('#restart').click();
  await expect(page.locator('#record')).toHaveText('정답 0 / 0');
  await expect(page.locator('#energy')).toHaveText('120 ⚡');
  await expect(page.locator('#start')).toHaveText('첫 전투 시작 →');
  expect(errors).toEqual([]);
});

test('wrong answers, hints, difficulty selection, and keyboard summoning', async ({ page }) => {
  await page.goto('/');
  await page.locator('#level').selectOption('intermediate');
  await page.locator('#start').click();
  await expect(page.locator('#level')).toBeDisabled();
  const word = await page.locator('#word').innerText();
  const buttons = page.locator('#options button');
  // Choose a visible wrong option, regardless of the random distractor order.
  const correct = banks.intermediate.find(w => w[0] === word)![1];
  const labels = await buttons.allTextContents();
  const index = labels.findIndex(label => !label.endsWith(correct));
  await page.keyboard.press(String(index + 1));
  await expect(page.locator('#record')).toHaveText('정답 0 / 1');
  await expect(page.locator('#review')).toContainText(word);
  await expect(page.locator('#feedback')).toContainText('정답은');
  await expect(page.locator('#options button').first()).toBeEnabled({ timeout: 5000 });
  await page.locator('#hint').click();
  await expect(page.locator('#feedback')).toContainText('문장 힌트:');
  const nextWord = await page.locator('#word').innerText();
  const nextMeaning = banks.intermediate.find(w => w[0] === nextWord)![1];
  await page.locator('#options').getByRole('button', { name: nextMeaning }).click();
  await expect(page.locator('#feedback')).toContainText('이번 보상은 없어요');
  await page.keyboard.press('q');
  await expect(page.locator('#unit0')).toBeDisabled();
  await page.locator('#restart').click();
  await expect(page.locator('#review')).toBeEmpty();
  await expect(page.locator('#level')).toHaveValue('intermediate');
});

test('mobile: responsive layout and touch controls remain usable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#start').tap();
  await expect(page.locator('#unit0')).toBeEnabled();
  await page.locator('#unit0').tap();
  await expect(page.locator('#unit0')).toBeDisabled();
  await page.locator('#pause').tap();
  await expect(page.locator('#overlayTitle')).toHaveText('잠깐, 쉬어가요.');
  await page.screenshot({ path: 'test-results/word-paws-mobile.png', fullPage: true });
  await context.close();
});
