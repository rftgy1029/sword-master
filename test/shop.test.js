import test from 'node:test';
import assert from 'node:assert/strict';
import { activateSlimeSkill, createEncounter, emptyLearning, encounterHealth, encounterQuestion, ENCOUNTERS, learningSummary, lensRemovedChoice, readLearning, recordAnswer, saveLearning } from '../src/battle.js';
import { battleReward, settleProgress, shopUnlocked, transactShop, useFocusLens } from '../src/progression.js';
import { CAPES, emptyEconomy, normalizeEconomy } from '../src/shop.js';
import { firstStoryProgress, STORIES } from '../src/story.js';

const lastScene = STORIES.bronze.scenes.at(-1);
const ending = { ...firstStoryProgress('bronze'), sceneId: lastScene.id, lineIndex: lastScene.lines.length - 1, completed: true };

function finish(learning, id, correct = true, cast = false) {
  let session = createEncounter(id, learning);
  while (encounterHealth(id, session) > 0) {
    const question = encounterQuestion(id, session);
    learning = recordAnswer(learning, id, session, session.answers.length, correct ? question.answerIndex : (question.answerIndex + 1) % 4);
    session = learning.encounters[id];
    if (cast && session.answers.length === 3) { learning = activateSlimeSkill(learning, session); session = learning.encounters[id]; }
  }
  return settleProgress(learning);
}

function bronze() { return settleProgress(ENCOUNTERS.reduce((learning, { id }) => finish(learning, id), emptyLearning()), ending); }
function roundTrip(learning) {
  let raw;
  assert.equal(saveLearning(learning, { setItem: (_, value) => { raw = value; } }), true);
  return readLearning({ getItem: () => raw });
}

test('only actual combat completion pays; a three-answer skill kill and five-answer fight credit exactly their answers', () => {
  const initial = emptyLearning();
  assert.equal(settleProgress(initial), initial);
  assert.equal(battleReward('slime', createEncounter('slime')), 0);
  const cast = finish(initial, 'slime', true, true);
  assert.equal(cast.economy.coins, 35);
  assert.equal(learningSummary(cast).answered, 3);
  const five = finish(initial, 'slime');
  assert.equal(five.economy.coins, 45);
  assert.equal(finish(initial, 'slime', false).economy.coins, 20);
  assert.equal(finish(initial, 'boss').economy.coins, 130);
  const puzzle = finish(initial, 'signs');
  assert.equal(puzzle.economy.coins, 0);
  assert.deepEqual(puzzle.economy.cleared, ['signs']);
});

test('reward receipt and balance round-trip together, revisits pay once, and a completed retry earns a new reward', () => {
  const first = finish(emptyLearning(), 'rescue');
  assert.equal(first.economy.coins, 50);
  assert.equal(first.encounters.rescue.rewarded, true);
  assert.equal(settleProgress(first), first);
  const restored = roundTrip(first);
  assert.deepEqual(restored, first);
  assert.equal(settleProgress(restored), restored);
  const fresh = createEncounter('rescue', restored);
  const retry = { ...restored, encounters: { ...restored.encounters, rescue: fresh } };
  assert.equal(settleProgress(retry), retry);
  assert.deepEqual(retry.economy.cleared, ['rescue']);
  const second = finish(retry, 'rescue');
  assert.equal(second.economy.coins, 100);
  assert.equal(learningSummary(second).answered, 12);
  assert.deepEqual(second.economy.cleared, ['rescue']);
});

test('shop requires every solved encounter plus the ending; reading, boss alone, or solved encounters alone cannot unlock', () => {
  const readOnly = settleProgress(emptyLearning(), ending);
  assert.equal(shopUnlocked(readOnly.economy), false);
  assert.equal(shopUnlocked(finish(readOnly, 'boss').economy), false);
  const solved = ENCOUNTERS.reduce((learning, { id }) => finish(learning, id), emptyLearning());
  assert.equal(shopUnlocked(solved.economy), false);
  const complete = settleProgress(solved, ending);
  assert.equal(shopUnlocked(complete.economy), true);
  const reread = settleProgress(complete, firstStoryProgress('bronze'));
  assert.equal(shopUnlocked(reread.economy), true);
  const retry = { ...reread, encounters: { ...reread.encounters, slime: createEncounter('slime') } };
  assert.equal(shopUnlocked(roundTrip(retry).economy), true);
  const endingFirst = ENCOUNTERS.reduce((learning, { id }) => finish(learning, id), readOnly);
  assert.equal(shopUnlocked(endingFirst.economy), true);
});

test('legacy completed saves gain their earned coins and unlock without changing learning history, then cannot be paid twice', () => {
  const complete = bronze();
  const old = { version: 1, encounters: structuredClone(complete.encounters), history: complete.history };
  for (const session of Object.values(old.encounters)) delete session.rewarded;
  // Old tutorial saves ended after four questions and did not have combat data.
  old.encounters.slime.answers = old.encounters.slime.answers.slice(0, 4);
  delete old.encounters.slime.combat;
  const restored = readLearning({ getItem: () => JSON.stringify(old) });
  const migrated = settleProgress(restored, ending);
  assert.equal(shopUnlocked(migrated.economy), true);
  assert.equal(migrated.economy.coins, complete.economy.coins - 5);
  assert.deepEqual(migrated.history, old.history);
  assert.equal(settleProgress(roundTrip(migrated), ending).economy.coins, migrated.economy.coins);
});

test('locked shops, insufficient funds and unknown items cannot spend coins or create inventory', () => {
  const locked = finish(emptyLearning(), 'boss');
  assert.equal(transactShop(locked, 'buy', 'forest'), locked);
  const poor = { ...bronze(), economy: { ...bronze().economy, coins: 0 } };
  assert.equal(transactShop(poor, 'buy', 'lens'), poor);
  assert.equal(transactShop(poor, 'buy', 'forest'), poor);
  assert.equal(transactShop(poor, 'equip', 'forest'), poor);
  assert.equal(transactShop(poor, 'buy', '__proto__'), poor);
});

test('buying a cape charges once and equips it; switching owned capes is free and survives reload', () => {
  const initial = bronze();
  const bought = transactShop(initial, 'buy', 'forest');
  assert.equal(bought.economy.coins, initial.economy.coins - 80);
  assert.equal(bought.economy.equipped, 'forest');
  assert.equal(transactShop(bought, 'buy', 'forest'), bought);
  const changed = transactShop(bought, 'equip', 'traveler');
  assert.equal(changed.economy.coins, bought.economy.coins);
  assert.equal(changed.economy.equipped, 'traveler');
  assert.deepEqual(roundTrip(changed), changed);
});

test('lens purchase and use are atomic, cannot repeat on a question, and never remove its correct option or add learning credit', () => {
  const initial = bronze();
  const bought = transactShop(initial, 'buy', 'lens');
  assert.equal(bought.economy.coins, initial.economy.coins - 40);
  assert.equal(bought.economy.lenses, 1);
  const retry = { ...bought, encounters: { ...bought.encounters, rescue: createEncounter('rescue') } };
  const session = retry.encounters.rescue;
  const used = useFocusLens(retry, 'rescue', session, 0);
  assert.equal(used.economy.lenses, 0);
  assert.deepEqual(used.encounters.rescue.hints, [0]);
  assert.deepEqual(used.history, retry.history);
  const question = encounterQuestion('rescue', session);
  const removed = lensRemovedChoice(question, used.encounters.rescue, 0);
  assert.notEqual(removed, question.answerIndex);
  assert.equal(recordAnswer(used, 'rescue', used.encounters.rescue, 0, removed), used);
  const extraLens = transactShop(used, 'buy', 'lens');
  assert.equal(useFocusLens(extraLens, 'rescue', extraLens.encounters.rescue, 0), extraLens);
  const restored = roundTrip(extraLens);
  assert.deepEqual(restored, extraLens);
  assert.equal(lensRemovedChoice(question, restored.encounters.rescue, 0), removed);
  const answered = recordAnswer(restored, 'rescue', restored.encounters.rescue, 0, question.answerIndex);
  assert.equal(lensRemovedChoice(encounterQuestion('rescue', answered.encounters.rescue), answered.encounters.rescue, 1), -1);
  const nextUse = useFocusLens(answered, 'rescue', answered.encounters.rescue, 1);
  assert.equal(nextUse.economy.lenses, 0);
  assert.deepEqual(nextUse.encounters.rescue.hints, [0, 1]);
});

test('invalid economy fields and hint indices recover without discarding valid answer history', () => {
  assert.deepEqual(normalizeEconomy({ coins: -1, lenses: 1.5, owned: { includes: 7 }, equipped: 'fake', cleared: 'slime', storyComplete: 'yes' }, ['slime']), emptyEconomy());
  const valid = finish(emptyLearning(), 'rescue');
  const raw = { version: 1, ...valid, economy: { ...valid.economy, coins: Infinity, lenses: 100, owned: ['fake', 'forest'], equipped: 'fake', cleared: ['rescue', 'fake'] } };
  raw.encounters.rescue.hints = [-1, 0, 0, 2, 30, '1'];
  const restored = readLearning({ getItem: () => JSON.stringify(raw) });
  assert.equal(restored.history.length, 6);
  assert.equal(restored.economy.coins, 0);
  assert.equal(restored.economy.lenses, 0);
  assert.deepEqual(restored.economy.owned, ['traveler', 'forest']);
  assert.equal(restored.economy.equipped, 'traveler');
  assert.deepEqual(restored.economy.cleared, ['rescue']);
  assert.deepEqual(restored.encounters.rescue.hints, [0, 2]);
  assert.equal(CAPES.length, 4);
});
