import test from 'node:test';
import assert from 'node:assert/strict';
import { attackPose, ATTACK_DURATION, ATTACK_HITS, impactsCrossed } from '../src/game/attackTimeline.js';
import { CARDS } from '../src/game/catalog.js';

test('every damaging card has a 2-second complete pose and matching single or multi-hit times', () => {
  assert.equal(ATTACK_DURATION, 2000);
  assert.deepEqual(Object.keys(ATTACK_HITS).sort(), Object.keys(CARDS).filter((id) => CARDS[id].damage).sort());
  for (const type of Object.keys(ATTACK_HITS)) {
    assert.equal(ATTACK_HITS[type].length, CARDS[type].hits ?? 1);
    const first = attackPose(type, 0), last = attackPose(type, 2000);
    for (const key of ['arm', 'advance', 'lean', 'lift']) {
      assert.ok(Math.abs(first[key]) < 1e-8);
      assert.ok(Math.abs(last[key]) < 1e-8, type + ' must return to rest');
    }
    assert.notEqual(attackPose(type, 500).arm, 0, 'Preparation changes the weapon pose');
    const delivered = [];
    for (let from = 0; from < 2000; from += 37) delivered.push(...impactsCrossed(type, from, Math.min(2000, from + 37)).map((hit) => hit.index));
    assert.deepEqual(delivered, ATTACK_HITS[type].map((_, i) => i), 'Every impact occurs once, including dropped frames');
  }
});
test('pose sampling stays finite and smooth across anticipation, impact and recovery', () => {
  for (const type of Object.keys(ATTACK_HITS)) {
    let before = attackPose(type, 0);
    for (let ms = 8; ms <= 2000; ms += 8) {
      const after = attackPose(type, ms);
      assert.ok(Object.values(after).every(Number.isFinite));
      assert.ok(Math.abs(after.advance - before.advance) < .03);
      assert.ok(Math.abs(after.arm - before.arm) < .3);
      before = after;
    }
  }
});
