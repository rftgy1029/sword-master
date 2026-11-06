import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../src/game/catalog.js';
import { emptyProgress, gameReducer, reachableNodes } from '../src/game/engine.js';
import { enemyAttackPlan, enemyAttackPose, enemyImpactsCrossed } from '../src/game/enemyAttackTimeline.js';
import { paintEnemyAttack } from '../src/game/enemyAttackEffects.js';

test('every monster turn delivers its actual hits once, reaches the hero and returns home', () => {
  for (const [type, monster] of Object.entries(MONSTERS)) {
    for (const block of [0, 5, 100]) {
      let before = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 42 });
      before = gameReducer(before, { type: 'SELECT_NODE', id: reachableNodes(before.run)[0].id });
      Object.assign(before.run.battle.enemy, { type, step: monster.pattern.findIndex((p) => p.kind === 'attack') });
      before.run.battle.block = block;
      const after = gameReducer(before, { type: 'END_TURN' });
      const effect = after.run.battle.effect, plan = enemyAttackPlan(type, effect);
      assert.equal(effect.kind, 'hurt');
      assert.equal(plan.hits.length, effect.impacts.length);
      assert.equal(before.run.hp - after.run.hp, effect.impacts.reduce((a, b) => a + b, 0));
      assert.deepEqual(enemyImpactsCrossed(plan, 0, plan.duration).map((h) => h.index), effect.impacts.map((_, i) => i));
      const delivered = [];
      for (let ms = 0; ms < plan.duration; ms += 137) delivered.push(...enemyImpactsCrossed(plan, ms, Math.min(ms + 137, plan.duration)).map((h) => h.index));
      assert.deepEqual(delivered, effect.impacts.map((_, i) => i), type + ' dropped frames');
      if (!plan.ranged) assert.ok(enemyAttackPose(plan, plan.hits[0]).advance > .8, type + ' must cross the gap to the hero');
      for (const end of [0, plan.duration]) for (const key of ['advance', 'lean', 'lift', 'recoil', 'squash']) {
        assert.ok(Math.abs(enemyAttackPose(plan, end)[key]) < 1e-8, type + ' returns to rest: ' + key);
      }
    }
  }
});

test('enemy poses stay continuous during multi-hit attacks and recover only after the last hit', () => {
  for (const type of Object.keys(MONSTERS)) {
    const plan = enemyAttackPlan(type, { impacts: [4, 4, 4] });
    let before = enemyAttackPose(plan, 0);
    for (let ms = 8; ms <= plan.duration; ms += 8) {
      const after = enemyAttackPose(plan, ms);
      assert.ok(Object.values(after).every(Number.isFinite));
      assert.ok(Math.abs(after.advance - before.advance) < .04);
      assert.ok(Math.abs(after.lean - before.lean) < 2);
      before = after;
    }
    if (!plan.ranged) assert.ok(enemyAttackPose(plan, plan.hits.at(-1)).advance > .8);
  }
});

test('all enemy effects draw finite visible geometry, including blocked hits and fatal recovery', () => {
  for (const type of Object.keys(MONSTERS)) {
    let strokes = 0;
    const g = {};
    for (const method of ['clear', 'lineStyle', 'strokeCircle', 'fillStyle', 'fillCircle', 'fillRect', 'beginPath', 'arc', 'strokePath', 'lineBetween']) {
      g[method] = (...args) => { assert.ok(args.every((v) => typeof v !== 'number' || Number.isFinite(v))); strokes++; return g; };
    }
    const actor = () => {
      const a = {};
      for (const method of ['setPosition', 'setAngle', 'setScale', 'setAlpha', 'setY', 'setFrame']) a[method] = () => a;
      return a;
    };
    const scene = { attackInk: g, heroHome: { x: 180 }, enemyHome: { x: 555 }, floor: 330, actorScale: 2,
      foe: actor(), adventurer: actor(), enemyFigure: actor(), heroSprite: actor(), heroShadow: actor(), playerFalling: true };
    const effect = { impacts: [0, 5, 5] }, plan = enemyAttackPlan(type, effect);
    for (let ms = 0; ms <= plan.duration; ms += 32) paintEnemyAttack(scene, { type, effect, plan }, ms);
    assert.ok(strokes > 1000, type + ' visible attack geometry');
  }
});
