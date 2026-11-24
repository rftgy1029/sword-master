import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, emptyProgress, reachableNodes, intentFor } from '../src/game/engine.js';
import { CARDS, cardDetails } from '../src/game/catalog.js';
import { questionById } from '../src/game/quiz.js';
import { loadProgress, persistProgress, validProgress } from '../src/game/storage.js';
import { TIERS } from '../src/vocabulary.js';
import { MIN_PATH_BATTLES, hasStoredRoutes, mapPaths, mapRuleProblems } from '../src/game/dungeonMap.js';

function start(seed = 1, tier = 'bronze') {
  const progress = emptyProgress();
  const index = TIERS.findIndex((t) => t.id === tier);
  if (index > 0) progress.learning.clears[TIERS[index - 1].id] = 1;
  return gameReducer(progress, { type: 'START', tier, seed });
}
function act(p, action) {
  const next = gameReducer(p, action);
  assert.notStrictEqual(next, p, action.type);
  assert.ok(validProgress(next), `invalid save after ${action.type}`);
  return next;
}
function winFight(p) {
  // A lethal fixture exercises the real select → answer → acknowledge path.
  const b = p.run.battle;
  const card = p.run.deck.find((c) => c.type === 'strike');
  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) b[pile] = b[pile].filter((uid) => uid !== card.uid);
  b.hand.push(card.uid);
  b.enemy.hp = 1;
  b.enemy.block = 0;
  p = act(p, { type: 'SELECT_CARD', uid: card.uid });
  const q = p.run.battle.pending.question;
  p = act(p, { type: 'ANSWER', id: q.id, answer: q.options.find((s) => questionById(q.id).answers.includes(s)) });
  return act(p, { type: 'ACK' });
}
// 저장 값만으로 지도 위 위치를 만든다(지나온 길은 실제로 이어진 경로여야 저장 검사를 통과한다).
function placeOn(p, path) {
  p = structuredClone(p);
  const last = path[path.length - 1];
  Object.assign(p.run, { phase: 'map', floor: last.floor, lane: last.lane, visited: path.map((n) => n.id), battle: null, reward: null, service: null });
  assert.ok(validProgress(p), 'placed position is a valid save');
  return p;
}
function finishReward(p) {
  if (!p.run.reward.cardTaken) p = act(p, { type: 'SKIP_CARD' });
  if (!p.run.reward.relicTaken) p = act(p, { type: 'TAKE_RELIC' });
  return act(p, { type: 'LEAVE_REWARD' });
}

test('300 generated dungeons are seeded, branch along stored paths and keep every route rule', () => {
  const layouts = new Set();
  for (let seed = 0; seed < 300; seed++) {
    const p = start(seed), r = p.run;
    assert.deepEqual(start(seed).run, r);
    layouts.add(JSON.stringify(r.map));
    assert.ok(hasStoredRoutes(r.map), 'new maps store their paths');
    assert.deepEqual(mapRuleProblems(r.map), [], `seed ${seed} breaks a route rule`);
    assert.deepEqual(reachableNodes(r), r.map[0]);
    for (let floor = 1; floor <= 5; floor++) for (const node of r.map[floor]) {
      // 갈림길은 1~2개, 옆 칸까지만 이어진다.
      assert.ok(node.next.length >= 1 && node.next.length <= 2);
      assert.ok(node.next.every((lane) => Math.abs(lane - node.lane) <= 1));
    }
    assert.ok(validProgress(p));
    assert.strictEqual(gameReducer(p, { type: 'SELECT_NODE', id: r.map[7][0].id }), p);
  }
  assert.ok(layouts.size > 250);
});

test('every route to the boss holds enough battles, and treasure always costs an elite', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { map } = start(seed).run;
    for (const path of mapPaths(map)) {
      assert.equal(path.length, 8);
      assert.ok(path.filter((n) => ['battle', 'elite', 'boss'].includes(n.type)).length >= MIN_PATH_BATTLES);
      const treasures = path.filter((n) => n.type === 'treasure').length;
      assert.ok(treasures <= 1);
      if (treasures) assert.ok(path.some((n) => n.type === 'elite'), 'no free treasure path');
    }
  }
});

test('a chosen lane closes the rooms it does not link to', () => {
  // 실제 지도 중 갈림길이 하나뿐인 방을 찾아, 그 방에서는 연결된 방만 고를 수 있는지 확인한다.
  for (let seed = 0; seed < 50; seed++) {
    let p = start(seed);
    const path = mapPaths(p.run.map).find((route) => route[1].next.length === 1);
    if (!path) continue;
    p = placeOn(p, path.slice(0, 2));
    assert.deepEqual(reachableNodes(p.run).map((n) => n.lane), path[1].next);
    const blocked = p.run.map[2].find((n) => !path[1].next.includes(n.lane));
    assert.strictEqual(gameReducer(p, { type: 'SELECT_NODE', id: blocked.id }), p);
    return;
  }
  assert.fail('no single-link room in 50 seeds');
});

test('legacy maps without stored paths still move by the old next-lane rule', () => {
  const p = start(3);
  for (const row of p.run.map) for (const node of row) delete node.next;
  assert.ok(validProgress(p), 'old saves keep loading');
  assert.equal(hasStoredRoutes(p.run.map), false);
  const moved = act(p, { type: 'SELECT_NODE', id: p.run.map[0][0].id });
  assert.ok(moved);
  // 일부만 길이 있는 지도는 손상된 저장으로 본다.
  const broken = start(3);
  delete broken.run.map[2][1].next;
  assert.equal(validProgress(broken), false);
});

test('card and relic rewards are offered once; skipping retains a compact deck', () => {
  let p = start();
  p = act(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
  const initialGold = p.run.gold;
  p = winFight(p);
  assert.equal(p.run.gold, initialGold + 25);
  const type = p.run.reward.cards[0];
  p = act(p, { type: 'TAKE_CARD', card: type });
  assert.equal(p.run.deck.length, 13);
  assert.strictEqual(gameReducer(p, { type: 'TAKE_CARD', card: type }), p);
  p = act(p, { type: 'LEAVE_REWARD' });
  assert.strictEqual(gameReducer(p, { type: 'LEAVE_REWARD' }), p);
  const treasure = reachableNodes(p.run).find((n) => n.type === 'treasure');
  p = act(p, { type: 'SELECT_NODE', id: treasure.id });
  assert.equal(p.run.phase, 'reward');
  assert.ok(p.run.reward.relic);
  assert.strictEqual(gameReducer(p, { type: 'LEAVE_REWARD' }), p);
  p = act(p, { type: 'TAKE_RELIC' });
  assert.equal(p.run.relics.length, 2);
  assert.strictEqual(gameReducer(p, { type: 'TAKE_RELIC' }), p);
  p = finishReward(p);
  assert.ok(validProgress(p));
});

test('rest is one choice; forge upgrades spend gold, cannot double-upgrade, and shop sells once', () => {
  const base = start();
  const paths = mapPaths(base.run.map);
  // 보스 전 쉼터(7층)로 이어지는 6층 방에서 휴식·대장간을 고른다.
  const toRest = paths.find((path) => path[6].type === 'rest');
  const toForge = paths.find((path) => path[6].type === 'forge');
  let p = placeOn(base, toRest.slice(0, 6));
  const rest = reachableNodes(p.run).find((n) => n.type === 'rest');
  p = act(p, { type: 'SELECT_NODE', id: rest.id });
  p.run.hp = 40;
  p = act(p, { type: 'REST' });
  assert.equal(p.run.hp, 64);
  assert.strictEqual(gameReducer(p, { type: 'REST' }), p);
  assert.strictEqual(gameReducer(p, { type: 'UPGRADE_CARD', uid: p.run.deck[0].uid }), p);
  p = placeOn(base, toForge.slice(0, 6));
  const forge = reachableNodes(p.run).find((n) => n.type === 'forge');
  p = act(p, { type: 'SELECT_NODE', id: forge.id });
  p.run.gold = 200;
  const uid = p.run.deck[0].uid;
  p = act(p, { type: 'UPGRADE_CARD', uid });
  assert.equal(p.run.gold, 170);
  assert.strictEqual(gameReducer(p, { type: 'UPGRADE_CARD', uid }), p);
  p = act(p, { type: 'UPGRADE_RELIC', id: 'bastion' });
  assert.equal(p.run.gold, 125);
  assert.equal(p.run.relics[0].level, 2);
  assert.strictEqual(gameReducer(p, { type: 'UPGRADE_RELIC', id: 'bastion' }), p);
  const card = p.run.service.stock[0];
  p = act(p, { type: 'BUY_CARD', card });
  assert.equal(p.run.gold, 90);
  assert.strictEqual(gameReducer(p, { type: 'BUY_CARD', card }), p);
  p = act(p, { type: 'LEAVE_FORGE' });
  assert.ok(validProgress(p));
});

test('boss victory records one clear, unlocks a card, and keeps records for the next adventure', () => {
  let p = start();
  for (let floor = 0; floor < 8; floor++) {
    const node = reachableNodes(p.run)[0];
    p = act(p, { type: 'SELECT_NODE', id: node.id });
    if (p.run.phase === 'battle') p = winFight(p);
    if (p.run.phase === 'reward') p = finishReward(p);
    if (p.run.phase === 'rest') p = act(p, { type: 'REST' });
    if (p.run.phase === 'forge') p = act(p, { type: 'LEAVE_FORGE' });
  }
  assert.equal(p.run.phase, 'result');
  assert.equal(p.run.result.won, true);
  assert.equal(p.learning.clears.bronze, 1);
  assert.equal(p.run.result.unlockedTier, 'silver');
  assert.deepEqual(p.learning.unlocked, ['oath']);
  assert.strictEqual(gameReducer(p, { type: 'ACK' }), p);
  const l = structuredClone(p.learning);
  assert.strictEqual(gameReducer(p, { type: 'START', seed: 2, tier: 'master' }), p);
  p = act(p, { type: 'START', seed: 2, tier: 'silver' });
  assert.deepEqual(p.learning.entries, l.entries);
  assert.deepEqual(p.learning.clears, l.clears);
  assert.deepEqual(p.learning.unlocked, ['oath']);
  assert.equal(p.run.deck.length, 12);
});

test('all tiers complete a real adventure with draw/turn rules and reload every state transition', () => {
  for (const tier of TIERS) for (const seed of [1, 17, 42]) {
    let p = start(seed, tier.id), raw = null;
    const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
    function advance(action) {
      p = act(p, action);
      assert.equal(persistProgress(p, raw, storage).ok, true);
      const loaded = loadProgress(storage);
      assert.equal(loaded.blocked, false);
      assert.deepEqual(loaded.progress, p);
      p = loaded.progress;
    }
    for (let n = 0; n < 1000 && p.run.phase !== 'result'; n++) {
      const r = p.run, b = r.battle;
      if (r.phase === 'map') {
        const priorities = { rest: 10, treasure: 9, battle: 5, forge: 3, elite: 0, boss: 10 };
        const node = reachableNodes(r).sort((a, b) => priorities[b.type] - priorities[a.type])[0];
        advance({ type: 'SELECT_NODE', id: node.id });
      } else if (r.phase === 'reward') {
        if (!r.reward.cardTaken) advance({ type: 'TAKE_CARD', card: r.reward.cards.find((t) => ['nova', 'twin', 'heal'].includes(t)) ?? r.reward.cards[0] });
        else if (!r.reward.relicTaken) advance({ type: 'TAKE_RELIC' });
        else advance({ type: 'LEAVE_REWARD' });
      } else if (r.phase === 'rest') advance({ type: 'REST' });
      else if (r.phase === 'forge') advance({ type: 'LEAVE_FORGE' });
      else if (b.feedback) advance({ type: 'ACK' });
      else if (b.pending) {
        const q = b.pending.question;
        advance({ type: 'ANSWER', id: q.id, answer: q.options.find((s) => questionById(q.id).answers.includes(s)) });
      } else {
        const cards = b.hand.map((uid) => r.deck.find((c) => c.uid === uid)).filter((c) => CARDS[c.type].cost <= b.energy);
        const intent = intentFor(b.enemy);
        const score = (card) => {
          const c = cardDetails(card);
          if (c.heal) return r.hp < r.maxHp - 7 ? 100 : -1;
          if (c.focus) return cards.some((other) => other.uid !== card.uid && cardDetails(other).damage) ? 90 : -1;
          if (c.strength) return b.turn < 4 ? 50 : 1;
          if (c.block && !c.damage) return intent.kind === 'attack' && b.block < intent.value ? 40 : 0;
          if (c.weak) return intent.value >= 10 && b.enemy.weak < 1 ? 30 : 0;
          return (c.damage + b.strength + b.focus) * (c.hits || 1) / (c.cost || 1) + 10;
        };
        cards.sort((a, b) => score(b) - score(a));
        advance(cards.length && score(cards[0]) > 0 ? { type: 'SELECT_CARD', uid: cards[0].uid } : { type: 'END_TURN' });
      }
    }
    assert.equal(p.run.result?.won, true, `${tier.id}, seed ${seed}`);
    assert.equal(p.learning.clears[tier.id], 1);
  }
});
