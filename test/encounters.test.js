import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseEncounter, emptyProgress, gameReducer, intentFor, reachableNodes } from '../src/game/engine.js';
import { MONSTERS, NORMAL_MONSTERS } from '../src/game/catalog.js';
import { MONSTER_ROWS } from '../src/game/spriteAssets.js';
import { validProgress } from '../src/game/storage.js';

test('encounter bag visits every normal monster before repeating and supports old runs', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const run = { rng: seed };
    const first = Array.from({ length: NORMAL_MONSTERS.length }, () => chooseEncounter(run, 'battle'));
    assert.equal(new Set(first).size, NORMAL_MONSTERS.length);
    assert.notEqual(chooseEncounter(run, 'battle'), first.at(-1));
    const a = chooseEncounter(run, 'elite'), b = chooseEncounter(run, 'elite');
    assert.notEqual(a, b);
    const restored = JSON.parse(JSON.stringify(run));
    assert.equal(chooseEncounter(run, 'battle'), chooseEncounter(restored, 'battle'));
  }
  assert.deepEqual(new Set(MONSTER_ROWS), new Set(Object.keys(MONSTERS)));
  assert.equal(new Set(Object.values(MONSTERS).map((m) => m.art)).size, Object.keys(MONSTERS).length);
});

test('every enemy pattern advertises exactly the damage, block, buff or wait that resolves after reload', () => {
  for (const [type, monster] of Object.entries(MONSTERS)) for (let step = 0; step < monster.pattern.length; step++) {
    let p = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 42 });
    p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
    Object.assign(p.run.battle.enemy, { type, step, strength: 2, weak: 1, block: 0 });
    p.run.battle.block = 5;
    p = JSON.parse(JSON.stringify(p));
    assert.ok(validProgress(p));
    const intent = intentFor(p.run.battle.enemy);
    const result = gameReducer(p, { type: 'END_TURN' });
    const expected = intent.kind === 'attack' ? Math.max(0, intent.value * (intent.hits ?? 1) - 5) : 0;
    assert.equal(p.run.hp - result.run.hp, expected, type + ' ' + step);
    if (intent.kind === 'attack') {
      assert.equal(result.run.battle.effect.impacts.length, intent.hits ?? 1);
      assert.equal(result.run.battle.effect.impacts.reduce((a,b) => a+b, 0), expected);
    }
    if (intent.kind === 'block') assert.equal(result.run.battle.enemy.block, intent.value);
    if (intent.kind === 'buff') assert.equal(result.run.battle.enemy.strength, 2 + intent.value);
    assert.ok(validProgress(result));
    delete result.run.encounterHistory;
    delete result.run.battle.effect.impacts;
    assert.ok(validProgress(result), 'Legacy optional fields remain readable');
  }
});
