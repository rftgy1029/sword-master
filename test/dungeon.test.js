import test from 'node:test';
import assert from 'node:assert/strict';
import { gameReducer, emptyProgress, reachableNodes, intentFor } from '../src/game/engine.js';
import { CARDS, cardDetails } from '../src/game/catalog.js';
import { questionById } from '../src/game/quiz.js';
import { loadProgress, persistProgress, validProgress } from '../src/game/storage.js';
import { TIERS } from '../src/vocabulary.js';

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
function finishReward(p) {
  if (!p.run.reward.cardTaken) p = act(p, { type: 'SKIP_CARD' });
  if (!p.run.reward.relicTaken) p = act(p, { type: 'TAKE_RELIC' });
  return act(p, { type: 'LEAVE_REWARD' });
}

test('300 generated dungeons are seeded, connected, have optional elites and safe rest/forge choices', () => {
  const layouts = new Set();
  for (let seed = 0; seed < 300; seed++) {
    const p = start(seed), r = p.run;
    assert.deepEqual(start(seed).run, r);
    layouts.add(JSON.stringify(r.map));
    assert.deepEqual(reachableNodes(r), r.map[0]);
    for (let floor = 0; floor < 7; floor++) {
      for (const node of r.map[floor]) assert.ok(r.map[floor + 1].some((to) => Math.abs(to.lane - node.lane) <= 1));
      if (floor === 2 || floor === 4) assert.equal(r.map[floor].filter((n) => n.type === 'battle').length, 2);
    }
    for (const floor of [3, 6]) assert.equal(r.map[floor].filter((n) => n.type === 'rest').length, 2);
    assert.ok(validProgress(p));
    assert.strictEqual(gameReducer(p, { type: 'SELECT_NODE', id: r.map[7][0].id }), p);
  }
  assert.ok(layouts.size > 50);
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
  let p = start();
  while (p.run.floor < 2) {
    const node = reachableNodes(p.run).find((n) => n.type === 'battle') ?? reachableNodes(p.run)[0];
    p = act(p, { type: 'SELECT_NODE', id: node.id });
    p = finishReward(winFight(p));
  }
  const before = structuredClone(p);
  const rest = reachableNodes(p.run).find((n) => n.type === 'rest');
  p = act(p, { type: 'SELECT_NODE', id: rest.id });
  p.run.hp = 40;
  p = act(p, { type: 'REST' });
  assert.equal(p.run.hp, 64);
  assert.strictEqual(gameReducer(p, { type: 'REST' }), p);
  assert.strictEqual(gameReducer(p, { type: 'UPGRADE_CARD', uid: p.run.deck[0].uid }), p);
  // Rewind the fixture to the same floor, choose a forge reachable from lane 1.
  p = before;
  p.run.lane = 1;
  p.run.visited[2] = 'node-2-1';
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
