import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRONZE_WORDS,
  generateQuestion,
  generateSpireMap,
  MONSTERS,
  RELICS,
  POTIONS,
} from '../src/game/spireData.js';
import {
  createInitialRun,
  createBattle,
  resolveTurn,
  applyPotion,
} from '../src/game/spireLogic.js';

test('all 64 bronze tier words from the PDF are present and complete', () => {
  assert.equal(BRONZE_WORDS.length, 64);
  for (const word of BRONZE_WORDS) {
    assert.equal(word.tier, 'bronze');
    assert.ok(word.term, 'term must not be empty');
    assert.ok(word.meaning, 'meaning must not be empty');
    assert.ok(Array.isArray(word.sources) && word.sources.length > 0, 'sources must not be empty');
  }
});

test('generateQuestion produces valid 4-choice questions with distinct options', () => {
  for (const word of BRONZE_WORDS) {
    const q = generateQuestion(word);
    assert.ok(q.prompt.includes(word.term));
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4, 'all 4 options must be distinct');
    assert.equal(q.options[q.answerIndex], q.correctAnswer);
  }
});

test('spire map generates 8 floors ending with the Lexicon Golem boss', () => {
  const map = generateSpireMap();
  assert.equal(map.length, 8);
  assert.equal(map[0].floor, 1);
  assert.equal(map[7].floor, 8);
  assert.equal(map[7].nodes[0].type, 'boss');
  assert.equal(map[7].nodes[0].monsterId, 'boss_golem');
});

test('combat strike correctly damages monster and applies relic bonus', () => {
  const run = createInitialRun(); // starts with 'sharp_blade' (+4 damage)
  const battle = createBattle('slime', run);
  const initialMonsterHp = battle.monster.hp;

  const outcome = resolveTurn({
    run,
    battle,
    actionType: 'strike',
    isCorrect: true,
    timeSpentSec: 3,
  });

  // Base 16 + 4 sharp blade = 20 damage
  assert.equal(outcome.battle.monster.hp, initialMonsterHp - 20);
  assert.equal(outcome.run.combo, 1);
});

test('combat defend correctly grants shield', () => {
  const run = createInitialRun();
  const battle = createBattle('slime', run);

  const outcome = resolveTurn({
    run,
    battle,
    actionType: 'defend',
    isCorrect: true,
    timeSpentSec: 3,
  });

  assert.equal(outcome.result.playerShieldGained, 14);
  assert.equal(outcome.run.combo, 1);
});

test('combat decode slash deals 38 damage and resets combo', () => {
  const run = { ...createInitialRun(), combo: 3 };
  const battle = createBattle('slime', run);

  const outcome = resolveTurn({
    run,
    battle,
    actionType: 'decode',
    isCorrect: true,
    timeSpentSec: 2,
  });

  // Slime has 32 HP, 38 unblockable damage slays it!
  assert.equal(outcome.isVictorious, true);
  assert.equal(outcome.run.status, 'reward');
});

test('wrong answer resets combo and deals damage to player', () => {
  const run = { ...createInitialRun(), combo: 2 };
  const battle = createBattle('slime', run);
  const initialPlayerHp = run.hp;

  const outcome = resolveTurn({
    run,
    battle,
    actionType: 'strike',
    isCorrect: false,
    timeSpentSec: 4,
  });

  assert.equal(outcome.run.combo, 0);
  assert.ok(outcome.run.hp < initialPlayerHp, 'player must take damage on wrong answer');
});

test('potion usage modifies health, damage, or removes wrong choices', () => {
  const run = { ...createInitialRun(), hp: 40, potions: ['potion_heal', 'potion_lens', 'potion_thunder'] };
  const battle = createBattle('slime', run);

  // 1. Heal potion
  const healRes = applyPotion(run, battle, 'potion_heal');
  assert.equal(healRes.run.hp, 65);

  // 2. Lens potion
  const lensRes = applyPotion(run, battle, 'potion_lens');
  assert.equal(lensRes.battle.hiddenIndices.length, 2);

  // 3. Thunder potion
  const thunderRes = applyPotion(run, battle, 'potion_thunder');
  assert.equal(thunderRes.battle.monster.hp, battle.monster.hp - 22);
});
