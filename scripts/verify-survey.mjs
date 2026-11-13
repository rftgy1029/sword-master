import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { emptyProgress, gameReducer, intentFor, reachableNodes } from '../src/game/engine.js';
import { questionById } from '../src/game/quiz.js';
import { PROGRESS_KEY, validProgress } from '../src/game/storage.js';

const BASE_URL = process.env.BROWSER_BASE_URL ?? 'http://127.0.0.1:8175/';
const artifactRoot = fileURLToPath(new URL('../artifacts/', import.meta.url));
mkdirSync(artifactRoot, { recursive: true });

function readyToWin(progress) {
  const run = progress.run, battle = run.battle;
  const card = run.deck.find((item) => item.type === 'strike');
  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) battle[pile] = battle[pile].filter((uid) => uid !== card.uid);
  battle.hand.unshift(card.uid);
  battle.enemy.hp = 1;
  battle.enemy.block = 0;
  return card.uid;
}

function bossFixture(tier = 'bronze') {
  const initial = emptyProgress();
  if (tier === 'silver') initial.learning.clears.bronze = 1;
  let progress = gameReducer(initial, { type: 'START', tier, seed: 42 });
  for (let step = 0; step < 100; step++) {
    const run = progress.run;
    let action;
    if (run.phase === 'map') {
      const nodes = reachableNodes(run);
      action = { type: 'SELECT_NODE', id: (nodes.find((node) => node.type === 'rest') ?? nodes.find((node) => node.type === 'battle') ?? nodes[0]).id };
    } else if (run.phase === 'battle') {
      const uid = readyToWin(progress);
      if (run.floor === 7) {
        assert.ok(validProgress(progress));
        return { progress, uid };
      }
      progress = gameReducer(progress, { type: 'SELECT_CARD', uid });
      const question = progress.run.battle.pending.question;
      progress = gameReducer(progress, { type: 'ANSWER', id: question.id, answer: question.options.find((answer) => questionById(question.id).answers.includes(answer)) });
      action = { type: 'ACK' };
    } else if (run.phase === 'reward') {
      action = !run.reward.cardTaken ? { type: 'SKIP_CARD' } : !run.reward.relicTaken ? { type: 'TAKE_RELIC' } : { type: 'LEAVE_REWARD' };
    } else if (run.phase === 'rest') action = { type: 'REST' };
    else throw new Error(`Unexpected fixture phase: ${run.phase}`);
    progress = gameReducer(progress, action);
  }
  throw new Error('Boss fixture did not complete');
}

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
const errors = [];
const settle = (page) => page.waitForFunction(() => !document.querySelector('.scene-transition'));
const read = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).progress, PROGRESS_KEY);

async function openFixture(fixture, spec) {
  const context = await browser.newContext({ viewport: spec.viewport, hasTouch: spec.viewport.width <= 500 });
  await context.addInitScript(({ progress, settings, key }) => {
    localStorage.setItem(key, JSON.stringify({ version: 1, progress }));
    localStorage.setItem('sword-master.settings.v1', JSON.stringify({ version: 1, settings }));
  }, { progress: fixture.progress, settings: { textSize: 'normal', backgroundMotion: 'off', selectionEffect: 'static', renderer: '2d', ...spec.settings }, key: PROGRESS_KEY });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(BASE_URL);
  assert.equal(await page.locator('.survey-dialog').count(), 0, 'No survey before clearing a dungeon');
  await page.getByRole('button', { name: /^이어하기/ }).click();
  await page.locator('.battle-screen[aria-busy="false"]').waitFor({ timeout: 25000 });
  await settle(page);
  return { context, page };
}

async function winBoss(page, uid) {
  await page.locator(`.card-hand [data-card-uid="${uid}"]`).click();
  const question = (await read(page)).run.battle.pending.question;
  const answerIndex = question.options.findIndex((option) => questionById(question.id).answers.includes(option));
  await page.locator('.quiz-options button').nth(answerIndex).click();
  await page.locator('.quiz-feedback .game-primary:not(:disabled)').click();
  await page.locator('.run-result').waitFor();
  await settle(page);
  assert.equal((await read(page)).run.result.won, true);
  assert.equal(await page.locator('.survey-dialog').count(), 0, 'The result screen stays visible until returning to title');
}

try {
  for (const spec of [
    { name: 'desktop', viewport: { width: 1366, height: 768 }, settings: { renderer: '3d', graphicsQuality: 'low', backgroundMotion: 'normal' } },
    { name: 'mobile-large', viewport: { width: 320, height: 568 }, settings: { textSize: 'larger' } },
  ]) {
    const fixture = bossFixture();
    const { context, page } = await openFixture(fixture, spec);
    await winBoss(page, fixture.uid);
    const completed = await read(page);
    await page.getByRole('button', { name: '타이틀로 돌아가기', exact: true }).click();
    await page.locator('.survey-dialog[open]').waitFor();
    await settle(page);
    assert.equal(await page.locator('.run-result').count(), 0);
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.equal(await page.locator('.survey-dialog [data-initial-focus]').evaluate((node) => node === document.activeElement), true);
    assert.deepEqual(await read(page), completed, 'Survey does not change the adventure or learning records');
    assert.equal(await page.locator('.survey-dialog').evaluate((node) => node.scrollWidth <= node.clientWidth), true);
    await page.locator('.survey-later').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.survey-later').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight && node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, 'Dismiss action is reachable on mobile with the largest text');
    await page.screenshot({ path: `${artifactRoot}bronze-survey-${spec.name}.png` });
    if (spec.name === 'desktop') await page.keyboard.press('Escape');
    else await page.locator('.survey-later').tap();
    await page.locator('.survey-dialog').waitFor({ state: 'detached' });
    await settle(page);
    assert.equal(await page.locator('.menu-button.is-selected').evaluate((node) => node === document.activeElement), true);
    await page.getByRole('button', { name: /^새 모험/ }).click();
    await page.getByRole('button', { name: '모험 닫고 타이틀로', exact: true }).click();
    await page.locator('.game-dialog').waitFor({ state: 'detached' });
    await settle(page);
    assert.equal(await page.locator('.survey-dialog').count(), 0, 'Closing a new-adventure picker after a bronze clear must not reopen the survey');
    assert.deepEqual(await read(page), completed);
    console.log(`${spec.name}: boss victory -> result -> title -> survey -> dismiss; records and menu focus preserved`);
    await context.close();
  }
  const silver = bossFixture('silver');
  const other = await openFixture(silver, { viewport: { width: 1366, height: 768 } });
  await winBoss(other.page, silver.uid);
  await other.page.getByRole('button', { name: '타이틀로 돌아가기', exact: true }).click();
  await other.page.locator('.game-dialog').waitFor({ state: 'detached' });
  assert.equal(await other.page.locator('.survey-dialog').count(), 0, 'Silver clear must not trigger the bronze survey');
  await other.context.close();

  const defeat = bossFixture();
  defeat.progress.run.hp = 1;
  while (intentFor(defeat.progress.run.battle.enemy).kind !== 'attack') defeat.progress.run.battle.enemy.step++;
  const last = await openFixture(defeat, { viewport: { width: 1366, height: 768 } });
  await last.page.locator('.end-turn').click();
  await last.page.locator('.run-result').waitFor();
  assert.equal((await read(last.page)).run.result.won, false);
  await last.page.getByRole('button', { name: '타이틀로 돌아가기', exact: true }).click();
  await last.page.locator('.game-dialog').waitFor({ state: 'detached' });
  assert.equal(await last.page.locator('.survey-dialog').count(), 0, 'Bronze defeat must not trigger a clear survey');
  await last.context.close();
  assert.deepEqual(errors, []);
  console.log('Silver victory and bronze defeat return normally; no browser errors');
} finally {
  await browser.close();
}
