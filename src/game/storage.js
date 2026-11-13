import { CARDS, MONSTERS, NODE_TYPES, RELICS } from './catalog.js';
import { emptyProgress } from './engine.js';
import { acceptsAnswer, distractorsFor, isCorrectAnswer, normalizeAnswer, questionById } from './quiz.js';
import { validWordbooks } from './wordbooks.js';
import { TIERS } from '../vocabulary.js';

export const PROGRESS_KEY = 'sword-master.adventure.v1';
const integer = (n, max = 100000000) => Number.isInteger(n) && n >= 0 && n <= max;
const object = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const tier = (id) => TIERS.some((t) => t.id === id);
const unique = (xs) => new Set(xs).size === xs.length;
const cardIds = (xs) => Array.isArray(xs) && xs.length <= 100 && xs.every((x) => typeof x === 'string');

function validQuestion(q, books, bookId) {
  const source = questionById(q?.id, books);
  if (!source || !Array.isArray(q.options) || (bookId !== undefined && (source.bookId ?? null) !== bookId)) return false;
  if (source.typing) return q.mode === 'typing' && q.options.length === 0;
  const distractors = distractorsFor(source);
  return q.mode === undefined && q.options.length === Math.min(4, distractors.length + 1) &&
    q.options.every((s) => [...source.answers, ...distractors].includes(s)) &&
    unique(q.options.map(normalizeAnswer)) && q.options.filter((s) => source.answers.includes(s)).length === 1;
}
function validFeedback(f, question, books) {
  return object(f) && acceptsAnswer(question, f.answer) && typeof f.correct === 'boolean' &&
    f.correct === isCorrectAnswer(question, f.answer, books);
}
function validBattle(b, run, books) {
  if (!object(b) || !object(b.enemy) || !MONSTERS[b.enemy.type] || !integer(b.turn) || b.turn < 1) return false;
  if (!['energy', 'block', 'strength', 'focus', 'streak'].every((key) => integer(b[key]))) return false;
  if (!['hp', 'maxHp', 'block', 'strength', 'weak', 'step'].every((key) => integer(b.enemy[key])) || b.enemy.maxHp < 1 || b.enemy.hp > b.enemy.maxHp) return false;
  if (!['hand', 'draw', 'discard', 'exhaust'].every((key) => cardIds(b[key])) || b.hand.length > 10) return false;
  const all = [...b.hand, ...b.draw, ...b.discard, ...b.exhaust];
  const bookId = tier(run.tier) ? null : run.tier;
  if (b.pending) {
    if (!validQuestion(b.pending.question, books, bookId) || b.feedback) return false;
    all.push(b.pending.uid);
  }
  if (!unique(all) || all.length !== run.deck.length || !all.every((uid) => run.deck.some((c) => c.uid === uid))) return false;
  if (b.feedback && (!validQuestion(b.feedback.question, books, bookId) || !validFeedback(b.feedback, b.feedback.question, books) || typeof b.feedback.cardName !== 'string')) return false;
  return Array.isArray(b.used) && unique(b.used) && b.used.every((id) => {
    const source = questionById(id, books);
    return source && (source.bookId ?? null) === bookId;
  }) &&
    typeof b.firstAttack === 'boolean' && typeof b.springUsed === 'boolean' && Array.isArray(b.log) && b.log.length <= 5 &&
    b.log.every((s) => typeof s === 'string') && object(b.effect) && integer(b.effect.id) && integer(b.effect.amount) &&
    ['start', 'attack', 'heal', 'block', 'miss', 'hurt', 'enemy'].includes(b.effect.kind) &&
    (b.effect.impacts === undefined || (Array.isArray(b.effect.impacts) && b.effect.impacts.length <= 10 && b.effect.impacts.every((n) => integer(n)))) &&
    (b.effect.cardType === undefined || !!CARDS[b.effect.cardType]) &&
    (b.effect.upgraded === undefined || typeof b.effect.upgraded === 'boolean') &&
    (b.effect.enemyAction === undefined || ['block', 'buff', 'charge', 'wait'].includes(b.effect.enemyAction));
}
function validRun(run, books) {
  if (run?.encounterHistory !== undefined && (!Array.isArray(run.encounterHistory) || run.encounterHistory.length > 32 || !run.encounterHistory.every((id) => !!MONSTERS[id]))) return false;
  if (!object(run) || (!tier(run.tier) && !books.some((book) => book.id === run.tier)) || !integer(run.rng, 4294967295) || !integer(run.seed, 4294967295)) return false;
  if (!['map', 'battle', 'reward', 'rest', 'forge', 'result'].includes(run.phase)) return false;
  if (!Number.isInteger(run.floor) || run.floor < -1 || run.floor > 7 || !integer(run.lane, 2)) return false;
  if (!['hp', 'maxHp', 'gold', 'nextCard', 'fights', 'answers', 'correct'].every((key) => integer(run[key])) || run.maxHp < 1 || run.hp > run.maxHp || run.correct > run.answers) return false;
  if (!Array.isArray(run.deck) || run.deck.length > 100 || !unique(run.deck.map((c) => c?.uid))) return false;
  if (!run.deck.every((c) => object(c) && /^card-\d+$/.test(c.uid) && Number(c.uid.slice(5)) < run.nextCard && CARDS[c.type] && typeof c.upgraded === 'boolean')) return false;
  if (!Array.isArray(run.relics) || !unique(run.relics.map((r) => r?.id)) || !run.relics.every((r) => RELICS[r?.id] && [1, 2].includes(r.level))) return false;
  if (!Array.isArray(run.map) || run.map.length !== 8) return false;
  for (let f = 0; f < 8; f++) {
    const row = run.map[f];
    if (!Array.isArray(row) || row.length !== (f === 0 || f === 7 ? 1 : 3)) return false;
    if (!unique(row.map((n) => n?.lane)) || !row.every((n) => n && n.floor === f && integer(n.lane, 2) && n.id === `node-${f}-${n.lane}` && NODE_TYPES[n.type])) return false;
    if ((f === 0 && (row[0].type !== 'battle' || row[0].lane !== 1)) || (f === 7 && (row[0].type !== 'boss' || row[0].lane !== 1))) return false;
  }
  if (!Array.isArray(run.visited) || run.visited.length !== run.floor + 1) return false;
  let lastLane = 1;
  for (let f = 0; f <= run.floor; f++) {
    const node = run.map[f].find((n) => n.id === run.visited[f]);
    if (!node || Math.abs(node.lane - lastLane) > 1) return false;
    lastLane = node.lane;
  }
  if (lastLane !== run.lane) return false;
  if (run.phase === 'result') return object(run.result) && typeof run.result.won === 'boolean' &&
    (run.result.unlockedTier === undefined || run.result.unlockedTier === null || tier(run.result.unlockedTier)) &&
    typeof run.result.unlocked === 'boolean' && integer(run.result.cards) && integer(run.result.relics) && !run.deck.length && !run.relics.length && run.battle === null;
  if (!run.hp || !run.deck.length || (run.floor === 7 && run.phase === 'map')) return false;
  const node = run.map[run.floor]?.find((n) => n.lane === run.lane);
  if (run.phase === 'battle') return ['battle', 'elite', 'boss'].includes(node?.type) && validBattle(run.battle, run, books);
  if (run.battle !== null) return false;
  if (run.phase === 'reward') return object(run.reward) && Array.isArray(run.reward.cards) && unique(run.reward.cards) && run.reward.cards.every((id) => CARDS[id]) &&
    (run.reward.relic === null || !!RELICS[run.reward.relic]) && integer(run.reward.gold) && typeof run.reward.cardTaken === 'boolean' && typeof run.reward.relicTaken === 'boolean';
  if (['rest', 'forge'].includes(run.phase)) return node?.type === run.phase && object(run.service) && Array.isArray(run.service.stock) && run.service.stock.every((id) => CARDS[id]) && typeof run.service.bought === 'boolean';
  return true;
}

function validReview(review, books, entries) {
  if (!object(review) || !validQuestion(review.question, books) ||
      (review.feedback !== null && !validFeedback(review.feedback, review.question, books))) return false;
  const session = review.session;
  return session === undefined || (object(session) && Array.isArray(session.ids) &&
    integer(session.index, session.ids.length - 1) && session.ids[session.index] === review.question.id &&
    unique(session.ids) && session.ids.every((id) => entries[id]?.wrong > 0));
}

export function validProgress(p) {
  try {
    if (!object(p) || p.version !== 1 || !object(p.learning)) return false;
    const books = p.wordbooks === undefined ? [] : p.wordbooks;
    if (!validWordbooks(books)) return false;
    const l = p.learning;
    if (!['attempts', 'correct', 'runs'].every((key) => integer(l[key])) || !object(l.entries) || !object(l.clears)) return false;
    if (!Object.entries(l.clears).every(([id, count]) => tier(id) && integer(count))) return false;
    if (l.bookClears !== undefined && (!object(l.bookClears) ||
        !Object.entries(l.bookClears).every(([id, count]) => books.some((book) => book.id === id) && integer(count)))) return false;
    if (!Array.isArray(l.unlocked) || !unique(l.unlocked) || !l.unlocked.every((id) => CARDS[id]?.unlock)) return false;
    let attempts = 0, correct = 0;
    for (const [id, e] of Object.entries(l.entries)) {
      if (!questionById(id, books) || !object(e) || !['attempts', 'correct', 'wrong', 'consecutive'].every((key) => integer(e[key])) ||
        typeof e.active !== 'boolean' || e.attempts !== e.correct + e.wrong || e.consecutive > e.correct) return false;
      attempts += e.attempts;
      correct += e.correct;
    }
    return attempts === l.attempts && correct === l.correct &&
      (p.review === null || validReview(p.review, books, l.entries)) &&
      (p.run === null || validRun(p.run, books));
  } catch { return false; }
}

export function loadProgress(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(PROGRESS_KEY);
    if (raw === null) return { progress: emptyProgress(), raw, blocked: false, error: '' };
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || !validProgress(saved.progress)) throw new Error('invalid');
    return { progress: saved.progress, raw, blocked: false, error: '' };
  } catch {
    return { progress: emptyProgress(), raw: null, blocked: true,
      error: '저장 기록을 읽지 못했습니다. 원본은 보존하며 이번 접속의 진행은 자동 저장하지 않습니다.' };
  }
}

export function persistProgress(progress, expectedRaw, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (target.getItem(PROGRESS_KEY) !== expectedRaw) return { ok: false, conflict: true,
      error: '다른 탭에서 기록이 변경되었습니다. 새로고침 후 이어해 주세요. 이 탭의 변경은 저장하지 않았습니다.' };
    const raw = JSON.stringify({ version: 1, progress });
    target.setItem(PROGRESS_KEY, raw);
    return { ok: true, raw, error: '' };
  } catch {
    return { ok: false, conflict: false, error: '브라우저에 저장할 수 없습니다. 이번 접속에서 플레이할 수 있지만 종료하면 새 진행이 사라집니다.' };
  }
}
