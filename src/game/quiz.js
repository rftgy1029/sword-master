import { findVocabulary, TIERS } from '../vocabulary.js';
import { shuffle } from './random.js';
import { MAX_TERM_LENGTH, normalizeText, validText } from './wordbooks.js';

// Reviewed groups: meanings within a row are distinct for the source sense.
// Never turn arbitrary words from the unreviewed archive into distractors.
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
    if (!word) throw new Error(`검수 단어 누락: ${term}`);
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
