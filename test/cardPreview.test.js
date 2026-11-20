import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, gameReducer, reachableNodes } from '../src/game/engine.js';
import { questionById } from '../src/game/quiz.js';
import { cardRoleTone, liveCardEffects, previewCardPlay, summarizeCardEffect } from '../src/game/cardPreview.js';

function startTestBattle(seed = 42) {
  let p = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed });
  p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  return p;
}

test('previewCardPlay matches real engine damage, block, heal, focus and relics', () => {
  const progress = startTestBattle(42);
  const run = progress.run;
  run.relics = [
    { id: 'bastion', level: 1 },
    { id: 'whetstone', level: 1 },
    { id: 'echo', level: 1 },
    { id: 'cadence', level: 1 },
  ];
  run.battle.strength = 2;
  run.battle.focus = 5;
  run.battle.streak = 2; // next correct answer triggers cadence (+6)
  run.battle.firstAttack = true;
  run.battle.enemy.block = 10;
  run.battle.enemy.hp = 50;

  const twin = run.deck.find((c) => c.type === 'twin');
  run.battle.hand = [twin.uid];
  const preview = previewCardPlay(run, twin);

  // Hit 1: 5 + 2(str) + 5(focus) + 4(whetstone) = 16
  // Hit 2: 5 + 2(str) + 5(focus) + 4(whetstone) + 3(echo) = 19
  // Cadence: +6
  // Total raw = 41, enemy block absorbs 10 => HP damage 31, enemy HP 19
  assert.deepEqual(preview.hitDamages, [16, 19]);
  assert.equal(preview.cadenceBonus, 6);
  assert.equal(preview.rawDamage, 41);
  assert.equal(preview.hpDamage, 31);
  assert.equal(preview.enemyHpAfter, 19);
  assert.equal(preview.lethal, false);

  // Compare directly against real engine execution
  let next = gameReducer(progress, { type: 'SELECT_CARD', uid: twin.uid });
  const q = next.run.battle.pending.question;
  const right = q.options.find((opt) => questionById(q.id).answers.includes(opt));
  next = gameReducer(next, { type: 'ANSWER', id: q.id, answer: right });
  assert.equal(next.run.battle.enemy.hp, preview.enemyHpAfter);
  assert.equal(next.run.battle.enemy.block, preview.enemyBlockAfter);
});

test('hovering guard or weaken updates enemy intent preview accurately', () => {
  const progress = startTestBattle(1);
  const run = progress.run;
  run.battle.enemy = { type: 'crawler', hp: 30, maxHp: 36, block: 0, strength: 0, weak: 0, step: 1 }; // attack 9
  run.battle.block = 0;

  const guard = run.deck.find((c) => c.type === 'guard');
  const guardPreview = previewCardPlay(run, guard);
  assert.equal(guardPreview.blockGain, 9);
  assert.equal(guardPreview.intentChanged, true);
  assert.equal(guardPreview.nextIntentView.stance, '방어됨');
  assert.equal(guardPreview.nextIntentView.tone, 'guarded');
  assert.equal(guardPreview.nextIntentView.damage.hpLoss, 0);

  const weaken = run.deck.find((c) => c.type === 'weaken');
  const weakPreview = previewCardPlay(run, weaken);
  assert.equal(weakPreview.weakGain, 2);
  assert.equal(weakPreview.intentChanged, true);
  assert.equal(weakPreview.nextIntent.value, 6); // floor(9 * 0.75) = 6
  assert.equal(weakPreview.nextIntentView.summary, 'HP -6 예상');
});

test('hovering a lethal attack marks lethal and intentChanged', () => {
  const progress = startTestBattle(7);
  const run = progress.run;
  run.battle.enemy.hp = 15;
  run.battle.enemy.block = 0;

  const heavy = run.deck.find((c) => c.type === 'heavy');
  const preview = previewCardPlay(run, heavy);
  assert.equal(preview.lethal, true);
  assert.equal(preview.enemyHpAfter, 0);
  assert.equal(preview.intentChanged, true);
});

test('liveCardEffects, summarizeCardEffect and cardRoleTone reflect live buffs', () => {
  const progress = startTestBattle(42);
  const run = progress.run;
  run.battle.focus = 5;
  const strike = run.deck.find((c) => c.type === 'strike');
  const parts = liveCardEffects(run, strike);
  assert.equal(parts[0].text, '피해 13');
  assert.equal(parts[0].boosted, true);
  assert.equal(summarizeCardEffect(run, strike), '피해 13');

  assert.equal(cardRoleTone('strike'), 'attack');
  assert.equal(cardRoleTone('guard'), 'guard');
  assert.equal(cardRoleTone('heal'), 'heal');
  assert.equal(cardRoleTone('weaken'), 'debuff');
  assert.equal(cardRoleTone('focus'), 'buff');
});
