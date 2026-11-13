import { CARDS, MONSTERS, NORMAL_MONSTERS, RELICS, cardDetails } from './catalog.js';
import { random, shuffle } from './random.js';
import { acceptsAnswer, isCorrectAnswer, makeQuestion, nextQuestion, questionById } from './quiz.js';
import { validWordbooks } from './wordbooks.js';
import { TIERS } from '../vocabulary.js';

export function emptyProgress() {
  return { version: 1, run: null, review: null, learning: { entries: {}, attempts: 0, correct: 0, runs: 0, clears: {}, unlocked: [] } };
}
// Old victories also open earlier tiers; unfinished legacy runs remain resumable.
export function unlockedTierIds(progress) {
  const highest = TIERS.reduce((max, tier, i) => progress.learning.clears[tier.id] > 0 ? i : max, -1);
  return TIERS.slice(0, Math.min(TIERS.length, highest + 2)).map((tier) => tier.id);
}
const relicLevel = (run, id) => run.relics.find((r) => r.id === id)?.level ?? 0;
const rng = (run) => () => random(run);
const pick = (run, items) => items[Math.floor(random(run) * items.length)];
const activeBattle = (run) => run?.phase === 'battle' && !run.battle.pending && !run.battle.feedback;

export function generateMap(run) {
  const layouts = [['battle'], ['battle', 'treasure', 'battle'], ['battle', 'elite', 'battle'],
    ['rest', 'forge', 'rest'], ['battle', 'elite', 'battle'], ['treasure', 'battle', 'treasure'],
    ['rest', 'forge', 'rest'], ['boss']];
  return layouts.map((types, floor) => shuffle(types, rng(run)).map((type, index) => ({
    id: `node-${floor}-${types.length === 1 ? 1 : index}`, floor, lane: types.length === 1 ? 1 : index, type,
  })));
}

function addCard(run, type) {
  const card = { uid: `card-${run.nextCard++}`, type, upgraded: false };
  run.deck.push(card);
  return card;
}

function createRun(tier, seed) {
  const run = { tier, rng: seed >>> 0, seed: seed >>> 0, phase: 'map', floor: -1, lane: 1, visited: [],
    hp: 72, maxHp: 72, gold: 35, deck: [], relics: [{ id: 'bastion', level: 1 }], nextCard: 0,
    battle: null, reward: null, service: null, result: null, fights: 0, answers: 0, correct: 0, encounterHistory: [] };
  for (const type of ['strike', 'strike', 'strike', 'guard', 'guard', 'heavy', 'twin', 'heal', 'empower', 'weaken', 'focus', 'flow']) addCard(run, type);
  run.map = generateMap(run);
  return run;
}

export function reachableNodes(run) {
  if (run?.phase !== 'map') return [];
  return (run.map[run.floor + 1] ?? []).filter((node) => Math.abs(node.lane - run.lane) <= 1);
}

export function intentFor(enemy) {
  const base = MONSTERS[enemy.type].pattern[enemy.step % MONSTERS[enemy.type].pattern.length];
  const value = base.kind === 'attack' ? Math.floor((base.value + enemy.strength) * (enemy.weak > 0 ? .75 : 1)) : base.value;
  const labels = { attack: `공격 ${value}${base.hits ? ` × ${base.hits}회` : ''}`, block: `방어 ${value} 획득`, buff: `힘 +${value}`, charge: `강타 준비 · 다음 행동에 기본 피해 ${value}`, wait: '숨 고르기 · 이번 행동은 공격하지 않음' };
  return { ...base, value, label: labels[base.kind] };
}

export function enemyDamageImpacts(intent, block) {
  return Array.from({ length: intent.hits ?? 1 }, () => {
    const absorbed = Math.min(block, intent.value);
    block -= absorbed;
    return intent.value - absorbed;
  });
}

export function enemyAttackCue(enemy, intent = intentFor(enemy)) {
  const { pattern } = MONSTERS[enemy.type];
  const previous = pattern[(enemy.step + pattern.length - 1) % pattern.length];
  return { heavy: enemy.step > 0 && previous.kind === 'charge', raw: intent.value };
}

function drawCards(run, count) {
  const b = run.battle;
  for (let i = 0; i < count && b.hand.length < 10; i++) {
    if (!b.draw.length) {
      b.draw = shuffle(b.discard, rng(run));
      b.discard = [];
    }
    if (!b.draw.length) break;
    b.hand.push(b.draw.pop());
  }
}

export function chooseEncounter(run, type) {
  const pool = type === 'boss' ? ['boss'] : type === 'elite' ? ['ravager', 'watcher'] : NORMAL_MONSTERS;
  const history = run.encounterHistory ?? [];
  const unseen = pool.filter((id) => !history.includes(id));
  const choices = unseen.length ? unseen : pool.filter((id) => id !== history.at(-1));
  const selected = pick(run, choices.length ? choices : pool);
  run.encounterHistory = [...history, selected].slice(-32);
  return selected;
}

function startBattle(run, type) {
  const monsterType = chooseEncounter(run, type);
  const monster = MONSTERS[monsterType];
  const maxHp = monster.hp + (type === 'boss' ? 0 : run.floor * 2);
  run.phase = 'battle';
  if (type === 'boss' && relicLevel(run, 'hearth')) run.hp = Math.min(run.maxHp, run.hp + (relicLevel(run, 'hearth') === 1 ? 16 : 26));
  run.battle = { enemy: { type: monsterType, hp: maxHp, maxHp, block: 0, strength: Math.floor(run.floor / 3), weak: 0, step: 0 },
    turn: 1, energy: 3, block: relicLevel(run, 'bastion') ? (relicLevel(run, 'bastion') === 1 ? 6 : 10) : 0,
    strength: 0, focus: 0, hand: [], draw: shuffle(run.deck.map((c) => c.uid), rng(run)), discard: [], exhaust: [],
    pending: null, feedback: null, used: [], streak: 0, firstAttack: true, springUsed: false,
    log: ['전투 시작 · 카드를 선택하고 단어의 힘을 깨우세요.'], effect: { id: 0, kind: 'start', amount: 0 } };
  drawCards(run, 5);
}

function damageEnemy(run, amount) {
  const enemy = run.battle.enemy;
  const absorbed = Math.min(enemy.block, amount);
  enemy.block -= absorbed;
  const dealt = Math.min(enemy.hp, amount - absorbed);
  enemy.hp -= dealt;
  return dealt;
}

function applyCard(run, card) {
  const b = run.battle;
  const c = cardDetails(card);
  const focus = c.focus ? 0 : b.focus;
  if (!c.focus) b.focus = 0;
  let damage = 0;
  const impacts = [];
  if (c.damage) {
    const first = b.firstAttack && relicLevel(run, 'whetstone') ? (relicLevel(run, 'whetstone') === 1 ? 4 : 7) : 0;
    for (let i = 0; i < (c.hits ?? 1); i++) {
      const echo = i > 0 && relicLevel(run, 'echo') ? (relicLevel(run, 'echo') === 1 ? 3 : 5) : 0;
      const dealt = damageEnemy(run, c.damage + b.strength + focus + first + echo);
      damage += dealt; impacts.push(dealt);
    }
    b.firstAttack = false;
  }
  if (c.block) b.block += c.block + focus;
  if (c.heal) run.hp = Math.min(run.maxHp, run.hp + c.heal + focus);
  if (c.strength) b.strength += c.strength + focus;
  if (c.weak) b.enemy.weak += c.weak + focus;
  if (c.focus) b.focus += c.focus;
  if (c.draw) drawCards(run, c.draw);
  if (!c.damage && !b.springUsed && relicLevel(run, 'spring')) {
    b.energy++;
    b.springUsed = true;
    if (relicLevel(run, 'spring') === 2) drawCards(run, 1);
  }
  b.effect = { id: b.effect.id + 1, kind: c.damage ? 'attack' : c.heal ? 'heal' : 'block', amount: damage || c.block || c.heal || c.strength || c.focus || c.weak,
    cardType: card.type, upgraded: card.upgraded, impacts };
  return c.damage ? `피해 ${damage}` : c.block ? `방어 +${c.block + focus}` : c.heal ? `HP 회복 ${c.heal + focus}` : '효과 발동';
}

function recordAnswer(progress, question, correct) {
  const entry = progress.learning.entries[question.id] ?? { attempts: 0, correct: 0, wrong: 0, consecutive: 0, active: false };
  entry.attempts++;
  if (correct) {
    entry.correct++;
    entry.consecutive++;
    if (entry.consecutive >= 2) entry.active = false;
    progress.learning.correct++;
  } else {
    entry.wrong++;
    entry.consecutive = 0;
    entry.active = true;
  }
  progress.learning.entries[question.id] = entry;
  progress.learning.attempts++;
}

function cardOffers(run, learning) {
  const available = Object.keys(CARDS).filter((id) => !CARDS[id].unlock || learning.unlocked.includes(id));
  const pool = [...available, ...available.filter((id) => CARDS[id].rarity === '일반')];
  return [...new Set(shuffle(pool, rng(run)))].slice(0, 3);
}

function relicOffer(run) {
  const unowned = Object.keys(RELICS).filter((id) => !relicLevel(run, id));
  if (unowned.length) return pick(run, unowned);
  return pick(run, run.relics.filter((r) => r.level < 2).map((r) => r.id)) ?? null;
}

function makeReward(progress, nodeType) {
  const run = progress.run;
  const relic = ['elite', 'treasure'].includes(nodeType) ? relicOffer(run) : null;
  const gold = nodeType === 'elite' ? 45 : nodeType === 'treasure' ? 20 : 25;
  run.gold += gold;
  run.reward = { cards: nodeType === 'treasure' ? [] : cardOffers(run, progress.learning), relic, gold,
    cardTaken: nodeType === 'treasure', relicTaken: !relic };
  run.battle = null;
  run.phase = 'reward';
}

function finishRun(progress, won) {
  const run = progress.run;
  const isSchool = TIERS.some((tier) => tier.id === run.tier);
  const previouslyOpen = unlockedTierIds(progress);
  const unlocked = won && isSchool && !progress.learning.unlocked.includes('oath');
  if (won) {
    const clears = isSchool ? progress.learning.clears : (progress.learning.bookClears ??= {});
    clears[run.tier] = (clears[run.tier] ?? 0) + 1;
    if (unlocked) progress.learning.unlocked.push('oath');
  }
  const unlockedTier = won ? unlockedTierIds(progress).find((id) => !previouslyOpen.includes(id)) ?? null : null;
  run.result = { won, cards: run.deck.length, relics: run.relics.length, unlocked, unlockedTier };
  run.phase = 'result';
  run.deck = [];
  run.relics = [];
  run.battle = null;
  run.reward = null;
  run.service = null;
}

function finishVictory(progress) {
  const run = progress.run;
  run.fights++;
  const type = run.map[run.floor].find((node) => node.lane === run.lane).type;
  if (type === 'boss') finishRun(progress, true);
  else makeReward(progress, type);
}

// A single pure reducer owns card consumption, quiz resolution, rewards and
// learning records. UI double-clicks and stale actions cannot grant extra effects.
export function gameReducer(current, action) {
  // Imported books are append-only. Keep their question pools reusable between turns.
  const { wordbooks, ...mutableProgress } = current;
  if (action.type === 'START') {
    const custom = wordbooks?.some((book) => book.id === action.tier);
    if ((!custom && !unlockedTierIds(current).includes(action.tier)) || !Number.isInteger(action.seed)) return current;
    const next = structuredClone(mutableProgress);
    if (wordbooks) next.wordbooks = wordbooks;
    next.run = createRun(action.tier, action.seed);
    next.learning.runs++;
    return next;
  }
  const next = structuredClone(mutableProgress);
  if (wordbooks) next.wordbooks = wordbooks;
  const run = next.run;
  const books = next.wordbooks ?? [];
  switch (action.type) {
    case 'ADD_WORDBOOK': {
      const updated = [...books, action.book];
      if (!validWordbooks(updated)) return current;
      next.wordbooks = [...books, structuredClone(action.book)];
      break;
    }
    case 'REVIEW_START': {
      const ids = action.ids ?? [action.id];
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length ||
          !ids.every((id) => next.learning.entries[id]?.wrong > 0) || !Number.isInteger(action.seed)) return current;
      const q = questionById(ids[0], books);
      if (!q) return current;
      const source = { rng: action.seed >>> 0 };
      next.review = { question: makeQuestion(q, rng(source)), feedback: null };
      if (ids.length > 1) next.review.session = { ids: [...ids], index: 0 };
      break;
    }
    case 'REVIEW_ANSWER': {
      const review = next.review;
      if (!review || review.feedback || review.question.id !== action.id || !acceptsAnswer(review.question, action.answer)) return current;
      const correct = isCorrectAnswer(review.question, action.answer, books);
      recordAnswer(next, review.question, correct);
      review.feedback = { correct, answer: action.answer };
      break;
    }
    case 'REVIEW_NEXT': {
      const review = next.review;
      if (!review?.feedback || review.question.id !== action.id || !Number.isInteger(action.seed)) return current;
      const session = review.session;
      if (!session || session.index + 1 === session.ids.length) {
        next.review = null;
      } else {
        const q = questionById(session.ids[++session.index], books);
        if (!q) return current;
        review.question = makeQuestion(q, rng({ rng: action.seed >>> 0 }));
        review.feedback = null;
      }
      break;
    }
    case 'REVIEW_CLOSE': next.review = null; break;
    case 'SELECT_NODE': {
      const node = reachableNodes(run).find((n) => n.id === action.id);
      if (!node) return current;
      run.floor = node.floor;
      run.lane = node.lane;
      run.visited.push(node.id);
      if (['battle', 'elite', 'boss'].includes(node.type)) startBattle(run, node.type);
      else if (node.type === 'treasure') makeReward(next, node.type);
      else {
        run.phase = node.type;
        run.battle = null;
        run.service = { stock: node.type === 'forge' ? cardOffers(run, next.learning) : [], bought: false };
      }
      break;
    }
    case 'SELECT_CARD': {
      if (!activeBattle(run)) return current;
      const b = run.battle;
      const card = run.deck.find((c) => c.uid === action.uid);
      if (!card || !b.hand.includes(card.uid) || CARDS[card.type].cost > b.energy) return current;
      const question = nextQuestion(run.tier, b.used, rng(run), books);
      if (!question) return current; // No valid item: never consume a card for a broken question.
      b.energy -= CARDS[card.type].cost;
      b.hand = b.hand.filter((uid) => uid !== card.uid);
      if (question.recycled) b.used = [];
      b.used.push(question.id);
      b.pending = { uid: card.uid, question };
      break;
    }
    case 'ANSWER': {
      const b = run?.battle;
      if (run?.phase !== 'battle' || !b.pending || b.feedback || b.pending.question.id !== action.id || !acceptsAnswer(b.pending.question, action.answer)) return current;
      const { question, uid } = b.pending;
      const card = run.deck.find((c) => c.uid === uid);
      const correct = isCorrectAnswer(question, action.answer, books);
      // Resolve before drawing: consumed cards leave the draw cycle on either answer.
      (CARDS[card.type].exhaust ? b.exhaust : b.discard).push(uid);
      b.pending = null;
      run.answers++;
      if (correct) run.correct++;
      recordAnswer(next, question, correct);
      b.streak = correct ? b.streak + 1 : 0;
      const effect = correct ? applyCard(run, card) : '효과 없음';
      if (!correct) b.effect = { id: b.effect.id + 1, kind: 'miss', amount: 0, cardType: card.type, upgraded: card.upgraded };
      if (correct && b.streak % 3 === 0 && relicLevel(run, 'cadence')) {
        const bonus = damageEnemy(run, relicLevel(run, 'cadence') === 1 ? 6 : 10);
        if (b.effect.kind === 'attack') {
          b.effect.amount += bonus;
          b.effect.impacts[b.effect.impacts.length - 1] += bonus;
        }
      }
      b.feedback = { question, answer: action.answer, correct, cardName: CARDS[card.type].name };
      b.log = [`${CARDS[card.type].name} · ${correct ? effect : '오답 · 에너지와 카드 소비, 효과 없음'}`, ...b.log].slice(0, 5);
      break;
    }
    case 'ACK': {
      if (run?.phase !== 'battle' || !run.battle.feedback) return current;
      run.battle.feedback = null;
      if (run.battle.enemy.hp <= 0) finishVictory(next);
      break;
    }
    case 'END_TURN': {
      if (!activeBattle(run)) return current;
      const b = run.battle;
      const intent = intentFor(b.enemy);
      b.discard.push(...b.hand);
      b.hand = [];
      b.enemy.block = 0;
      if (intent.kind === 'attack') {
        const impacts = enemyDamageImpacts(intent, b.block);
        const amount = impacts.reduce((total, hit) => total + hit, 0);
        const absorbed = intent.value * impacts.length - amount;
        run.hp = Math.max(0, run.hp - amount);
        b.log = [`${intent.label} · 방어 ${absorbed} · HP −${amount}`, ...b.log];
        b.effect = { id: b.effect.id + 1, kind: 'hurt', amount, impacts };
      } else if (intent.kind === 'block') b.enemy.block = intent.value;
      else if (intent.kind === 'buff') b.enemy.strength += intent.value;
      if (intent.kind !== 'attack') {
        b.log = [`적 행동 · ${intent.label}`, ...b.log];
        b.effect = { id: b.effect.id + 1, kind: 'enemy', amount: 0, enemyAction: intent.kind };
      }
      b.log = b.log.slice(0, 5);
      b.enemy.step++;
      b.enemy.weak = Math.max(0, b.enemy.weak - 1);
      if (run.hp === 0) finishRun(next, false);
      else {
        b.block = 0;
        b.turn++;
        b.energy = 3;
        b.springUsed = false;
        drawCards(run, 5);
      }
      break;
    }
    case 'TAKE_CARD': {
      if (run?.phase !== 'reward' || run.reward.cardTaken || !run.reward.cards.includes(action.card)) return current;
      addCard(run, action.card);
      run.reward.cardTaken = true;
      break;
    }
    case 'SKIP_CARD':
      if (run?.phase !== 'reward' || run.reward.cardTaken) return current;
      run.reward.cardTaken = true;
      break;
    case 'TAKE_RELIC': {
      if (run?.phase !== 'reward' || run.reward.relicTaken || !run.reward.relic) return current;
      const owned = run.relics.find((r) => r.id === run.reward.relic);
      if (owned) owned.level = 2;
      else run.relics.push({ id: run.reward.relic, level: 1 });
      run.reward.relicTaken = true;
      break;
    }
    case 'LEAVE_REWARD':
      if (run?.phase !== 'reward' || !run.reward.cardTaken || !run.reward.relicTaken) return current;
      run.reward = null;
      run.battle = null;
      run.phase = 'map';
      break;
    case 'REST':
      if (run?.phase !== 'rest') return current;
      run.hp = Math.min(run.maxHp, run.hp + 24);
      run.phase = 'map';
      run.service = null;
      break;
    case 'UPGRADE_CARD': {
      if (!['rest', 'forge'].includes(run?.phase)) return current;
      const card = run.deck.find((c) => c.uid === action.uid);
      const price = run.phase === 'rest' ? 0 : 30;
      if (!card || card.upgraded || run.gold < price) return current;
      card.upgraded = true;
      run.gold -= price;
      if (run.phase === 'rest') { run.phase = 'map'; run.service = null; }
      break;
    }
    case 'UPGRADE_RELIC': {
      const relic = run?.relics.find((r) => r.id === action.id);
      if (run?.phase !== 'forge' || !relic || relic.level !== 1 || run.gold < 45) return current;
      relic.level = 2;
      run.gold -= 45;
      break;
    }
    case 'BUY_CARD':
      if (run?.phase !== 'forge' || run.service.bought || run.gold < 35 || !run.service.stock.includes(action.card)) return current;
      run.gold -= 35;
      addCard(run, action.card);
      run.service.bought = true;
      break;
    case 'LEAVE_FORGE':
      if (run?.phase !== 'forge') return current;
      run.phase = 'map';
      run.service = null;
      break;
    default: return current;
  }
  return next;
}
