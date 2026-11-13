import { findVocabulary, TIERS } from '../vocabulary.js';
import { shuffle } from './random.js';
import { MAX_TERM_LENGTH, normalizeText, validText } from './wordbooks.js';

// Hand-made groups: meanings within a row are distinct for the source sense.
// Words outside these groups get automatic meaning choices further below.
const MEANING_GROUPS = [
  ['additional', 'complex', 'central', 'financial', 'physical', 'annual', 'effective', 'particular'],
  ['protect', 'link', 'challenge', 'contact', 'judge', 'realize', 'wonder', 'spread'],
  ['income', 'majority', 'risk', 'surface', 'species', 'strength', 'waste', 'feature'],
  ['immediately', 'previously', 'eventually', 'definitely', 'pre-modern', 'separate', 'senior', 'remain'],
  ['target', 'administration', 'captain', 'cell', 'cancer', 'population', 'loss', 'demand'],
  ['absolute', 'acquired', 'ancient', 'appropriate', 'as a whole', 'alternative', 'according to', 'access to'],
  ['abandon', 'absorb', 'accidentally', 'accommodate', 'accomplish', 'acknowledge', 'acquire', 'activate'],
  ['a sense of ease', 'accelerate', 'accumulate', 'adequately', 'adjust to', 'adulthood', 'aroma', 'assemble'],
  ['accustomed to', 'align with', 'at best', 'be called upon to', 'blind oneself to', 'bother to', 'clothed in', 'deprive A of B'],
];

// Each row supplies three reviewed WRONG choices. All source-listed answers
// are accepted, rather than picking one synonym and treating others as wrong.
const RELATION_CHOICES = [
  ['complex', 'silent|annual|fragile', 'noisy|ancient|distant'],
  ['protect', 'divide|measure|forget', 'gather|observe|borrow'],
  ['link', 'destroy|observe|imagine', 'collect|reduce|arrive'],
  ['risk', 'income|surface|species', 'price|winter|shape'],
  ['majority', 'surface|danger|income', 'safety|intensity|exterior'],
  ['surface', 'danger|earnings|intensity', 'minority|safety|weakness'],
  ['immediately', 'previously|silently|yearly', 'quietly|certainly|annually'],
  ['senior', 'separate|complex|financial', 'connected|simple|limited'],
  ['acquired', 'ancient|limited|suitable', 'modern|inappropriate|total'],
  ['ancient', 'suitable|learned|limited', 'innate|total|inappropriate'],
  ['appropriate', 'ancient|learned|total', 'modern|innate|limited'],
  ['absolute', 'suitable|learned|ancient', 'inappropriate|modern|innate'],
  ['absorb', 'give up|achieve|lose', 'keep|fail|deny'],
  ['accidentally', 'eagerly|silently|slowly', 'annually|silently|previously'],
  ['accomplish', 'absorb|abandon|exclude', 'emit|include|keep'],
  ['activate', 'abandon|include|obtain', 'achieve|keep|lose'],
  ['accelerate', 'gather|resist|allocate', 'preserve|withhold|adapt to'],
  ['adulthood', 'aroma|anxiety|assertion', 'denial|stink|preservation'],
  ['adequately', 'eagerly|silently|annually', 'deliberately|silently|instantly'],
  ['assemble', 'resist|hasten|withhold', 'adapt to|speed up|allocate'],
  ['accustomed to', 'covered with|in conflict with|at most', 'in line with|at worst|provided with'],
  ['align with', 'take from|ignore|be asked to', 'provide with|recognize|be excused from'],
  ['be called upon to', 'ignore|agree with|take from', 'recognize|conflict with|provide with'],
  ['deprive A of B', 'agree with|ignore|be asked to', 'conflict with|recognize|be excused from'],
];

export const QUIZ_TYPES = { meaning: '뜻', synonym: '유의어', antonym: '반의어' };
const words = findVocabulary({ tier: 'master' });
const byTerm = new Map(words.map((word) => [word.term, word]));
export const normalizeAnswer = normalizeText;

function sourceAnswers(text) {
  // Multi-sense and relative-word annotations require separate editorial work.
  if (!text || text === '—' || /[①-⑨\[\]]/.test(text)) return [];
  return text.replace(/\([^)]*\)/g, '').split(',').map((s) => s.trim()).filter(Boolean);
}

const reviewed = [];
for (const terms of MEANING_GROUPS) {
  for (const term of terms) {
    const word = byTerm.get(term);
    if (!word) throw new Error(`선택지 묶음의 단어 누락: ${term}`);
    reviewed.push({ id: `${word.id}:meaning`, wordId: word.id, type: 'meaning', word,
      answers: [word.meaning], distractors: terms.filter((t) => t !== term).map((t) => byTerm.get(t).meaning) });
  }
}
for (const [term, synonyms, antonyms] of RELATION_CHOICES) {
  const word = byTerm.get(term);
  for (const [type, field, wrong] of [['synonym', 'synonyms', synonyms], ['antonym', 'antonyms', antonyms]]) {
    const answers = sourceAnswers(word[field]);
    if (answers.length && wrong.split('|').every((s) => !answers.map(normalizeAnswer).includes(normalizeAnswer(s)))) {
      reviewed.push({ id: `${word.id}:${type}`, wordId: word.id, type, word, answers, distractors: wrong.split('|') });
    }
  }
}

// Every other word in the teacher's list gets a meaning question too. Its wrong
// choices are the meanings of other words of the same kind (multi-sense or not,
// verb/adjective/adverb/noun), same tier first, so the format never gives the
// answer away. A candidate is skipped when its meaning shares a stem with the
// answer or when either word lists the other as a synonym or antonym.
const AUTO_DISTRACTORS = 7;
const termKey = (term) => normalizeAnswer(term.replace(/\([^)]*\)/g, ''));
const senses = (meaning) => meaning.replace(/\([^)]*\)/g, ' ').split(/[①-⑨]/).map((s) => s.trim()).filter(Boolean);
function wordKind(word) {
  if (/ly$/i.test(word.term.trim())) return 'adverb';
  const first = (senses(word.meaning)[0] ?? '').split(',')[0].trim();
  if (/다$/.test(first)) return 'verb';
  if (/(한|인|의|운|된|은|는|른|난|진|던|할|될)$/.test(first)) return 'adjective';
  return 'noun';
}
const SUFFIXES = ['하게', '하는', '하다', '되다', '이다', '적인', '적으로', '으로', '하여', '한', '히', '의', '다', '게', '된', '인', '적'];
function stems(meaning) {
  const out = new Set();
  for (const token of meaning.replace(/\([^)]*\)/g, ' ').split(/[,·/;①-⑨\s~]+/)) {
    let stem = token.replace(/[^가-힣]/g, '');
    for (const suffix of SUFFIXES) if (stem.length > suffix.length + 1 && stem.endsWith(suffix)) { stem = stem.slice(0, -suffix.length); break; }
    if (stem) out.add(stem);
  }
  return out;
}
const relatedTerms = (word) => new Set([word.synonyms, word.antonyms].join(',').replace(/\([^)]*\)/g, '')
  .split(/[,①-⑨]/).map((s) => normalizeAnswer(s)).filter(Boolean));
const info = new Map(words.map((word) => [word.id, {
  kind: wordKind(word), multi: /[①-⑨]/.test(word.meaning), stems: stems(word.meaning),
  meaning: normalizeAnswer(word.meaning), term: termKey(word.term), related: relatedTerms(word),
}]));
function overlaps(a, b) {
  for (const x of a) for (const y of b) if (x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)))) return true;
  return false;
}
// Different spellings of one idea; meanings that hit the same row never face each other.
const NEAR_MEANINGS = [
  ['중요', '주요', '주된', '핵심', '중대', '상당', '의미있'], ['분명', '명백', '확실', '뚜렷', '명확', '틀림없'],
  ['이익', '이득', '혜택', '이점', '유익', '수익'], ['결국', '마침내', '최종', '끝내'], ['즉시', '즉각', '곧바로', '당장'],
  ['이전', '예전', '과거', '사전', '앞선', '먼저'], ['증가', '늘리', '늘어', '증대', '확대'], ['감소', '줄이', '줄어', '축소'],
  ['부족', '결핍', '모자'], ['주목', '주의', '알아차', '인지', '인식', '눈치'], ['언급', '논평', '말하', '진술', '주장'],
  ['공식', '공무', '관리', '당국', '권위'], ['연습', '훈련', '실천', '관행'], ['가능', '잠재'], ['처리', '다루', '취급'],
  ['남은', '잔해', '나머지', '여분', '추가', '남다'], ['이론', '가설', '학설'], ['가치', '값', '수치'], ['정의', '공정', '재판'],
  ['이끌', '촉진', '추진', '몰다', '운전'], ['일치', '맞추', '어울', '조화'], ['다가', '접근'], ['최고', '수석', '으뜸', '주된'],
];
const nearRows = (meaning) => new Set(NEAR_MEANINGS.flatMap((row, i) => row.some((w) => meaning.includes(w)) ? [i] : []));
for (const word of words) info.get(word.id).near = nearRows(word.meaning);
function safeDistractor(word, other) {
  const a = info.get(word.id), b = info.get(other.id);
  return other.id !== word.id && a.meaning !== b.meaning && a.term !== b.term &&
    !a.related.has(b.term) && !b.related.has(a.term) && ![...a.related].some((t) => b.related.has(t)) &&
    !overlaps(a.stems, b.stems) && ![...a.near].some((i) => b.near.has(i));
}
function hash(text) { // FNV-1a: a fixed, data-only order keeps saved choices valid across reloads
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
function autoDistractors(word) {
  const me = info.get(word.id);
  const passes = [(o) => o.tier === word.tier && info.get(o.id).multi === me.multi && info.get(o.id).kind === me.kind,
    (o) => info.get(o.id).multi === me.multi && info.get(o.id).kind === me.kind,
    (o) => info.get(o.id).multi === me.multi, () => true];
  const chosen = [];
  const seen = new Set([me.meaning]);
  for (const pass of passes) {
    const pool = words.filter((o) => pass(o) && safeDistractor(word, o)).sort((x, y) => hash(word.id + x.id) - hash(word.id + y.id));
    for (const other of pool) {
      const key = info.get(other.id).meaning;
      if (seen.has(key) || chosen.some((c) => overlaps(info.get(c.id).stems, info.get(other.id).stems))) continue;
      seen.add(key); chosen.push(other);
      if (chosen.length === AUTO_DISTRACTORS) return chosen.map((o) => o.meaning);
    }
  }
  return chosen.map((o) => o.meaning);
}
const handMade = new Set(reviewed.filter((q) => q.type === 'meaning').map((q) => q.wordId));
for (const word of words) {
  if (handMade.has(word.id)) continue;
  reviewed.push({ id: `${word.id}:meaning`, wordId: word.id, type: 'meaning', word, answers: [word.meaning], distractors: autoDistractors(word) });
}

export const QUESTION_BANK = reviewed;
const byId = new Map(reviewed.map((q) => [q.id, q]));
export function questionById(id, wordbooks = []) {
  const schoolQuestion = byId.get(id);
  if (schoolQuestion || typeof id !== 'string') return schoolQuestion;
  const match = /^(book-[a-f0-9-]{36}):(0|[1-9]\d*):meaning$/.exec(id);
  const book = match && wordbooks.find(({ id: bookId }) => bookId === match[1]);
  return book ? customQuestions(book)[Number(match[2])] : undefined;
}

const customPools = new WeakMap();
function customQuestions(book) {
  if (customPools.has(book)) return customPools.get(book);
  const meanings = new Map();
  const meaningsByTerm = new Map();
  const termsByMeaning = new Map();
  for (const word of book.words) {
    const term = normalizeAnswer(word.term);
    const meaning = normalizeAnswer(word.meaning);
    meanings.set(meaning, word.meaning);
    if (!meaningsByTerm.has(term)) meaningsByTerm.set(term, new Set());
    meaningsByTerm.get(term).add(meaning);
    if (!termsByMeaning.has(meaning)) termsByMeaning.set(meaning, new Set());
    termsByMeaning.get(meaning).add(term);
  }
  const pool = book.words.map((word, index) => {
    const wordId = `${book.id}:${index}`;
    const excludedMeanings = meaningsByTerm.get(normalizeAnswer(word.term));
    const typing = excludedMeanings.size === meanings.size;
    return {
      id: `${wordId}:meaning`, wordId, bookId: book.id, type: 'meaning', typing,
      word: { ...word, id: wordId, sources: [book.name] },
      answers: [typing ? word.term : word.meaning], meanings, excludedMeanings,
      typingAnswers: typing ? termsByMeaning.get(normalizeAnswer(word.meaning)) : undefined,
    };
  });
  customPools.set(book, pool);
  return pool;
}

export function questionPool(tier, wordbooks = []) {
  const book = wordbooks.find(({ id }) => id === tier);
  if (book) return customQuestions(book);
  const tierIndex = TIERS.findIndex((t) => t.id === tier);
  const allowed = new Set(TIERS.slice(0, tierIndex + 1).map((t) => t.id));
  return reviewed.filter((q) => allowed.has(q.word.tier));
}

export function makeQuestion(template, nextRandom = Math.random) {
  if (template.typing) return { id: template.id, mode: 'typing', options: [] };
  const wrong = shuffle(distractorsFor(template), nextRandom).slice(0, 3);
  const answer = template.answers[Math.floor(nextRandom() * template.answers.length)];
  return { id: template.id, options: shuffle([answer, ...wrong], nextRandom) };
}

export function distractorsFor(template) {
  if (!template.bookId) return template.distractors;
  return [...template.meanings].filter(([key]) => !template.excludedMeanings.has(key)).map(([, meaning]) => meaning);
}

export function nextQuestion(tier, used, nextRandom, wordbooks) {
  const pool = questionPool(tier, wordbooks);
  const usedIds = new Set(used);
  let available = pool.filter((q) => !usedIds.has(q.id));
  const recycled = available.length === 0;
  if (recycled) available = pool;
  if (!available.length) return null;
  // Favor words not yet encountered, then allow other question types for them.
  const usedWords = new Set(pool.filter((q) => usedIds.has(q.id)).map((q) => q.wordId));
  const unseen = available.filter((q) => !usedWords.has(q.wordId));
  if (unseen.length) available = unseen;
  const template = available[Math.floor(nextRandom() * available.length)];
  return { ...makeQuestion(template, nextRandom), recycled };
}

export function acceptsAnswer(question, answer) {
  return question.mode === 'typing' ? validText(answer, MAX_TERM_LENGTH) : question.options.includes(answer);
}

export function isCorrectAnswer(question, answer, wordbooks) {
  if (typeof answer !== 'string') return false;
  const source = questionById(question.id, wordbooks);
  const normalized = normalizeAnswer(answer);
  return source?.typing ? source.typingAnswers.has(normalized) :
    (source?.answers.some((s) => normalizeAnswer(s) === normalized) ?? false);
}
