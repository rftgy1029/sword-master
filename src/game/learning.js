import { questionPool, QUIZ_TYPES } from './quiz.js';
import { TIERS } from '../vocabulary.js';

export function learningRows(progress, scope = 'all') {
  const books = progress.wordbooks ?? [];
  const pool = scope === 'all'
    ? [...questionPool('master'), ...books.flatMap(({ id }) => questionPool(id, books))]
    : questionPool(scope, books);
  const school = TIERS.find(({ id }) => id === (scope === 'all' ? 'master' : scope));
  const bookNames = new Map(books.map(({ id, name }) => [id, name]));
  const rows = pool.flatMap((question) => {
    const entry = progress.learning.entries[question.id];
    if (!entry?.attempts) return [];
    const source = question.bookId ? bookNames.get(question.bookId) : TIERS.find(({ id }) => id === question.word.tier).label;
    return [{ question, entry, source }];
  });
  return {
    rows,
    quizWords: new Set(pool.map(({ wordId }) => wordId)).size,
    totalWords: (school?.count ?? 0) + books.filter(({ id }) => scope === 'all' || scope === id)
      .reduce((sum, { words }) => sum + words.length, 0),
  };
}

export function wrongRows(rows) {
  return rows.filter(({ entry }) => entry.wrong > 0).sort((a, b) =>
    Number(b.entry.active) - Number(a.entry.active) || b.entry.wrong - a.entry.wrong ||
    a.question.word.term.localeCompare(b.question.word.term, 'en'));
}

export function learningStats(rows) {
  const stats = { studied: new Set(rows.map(({ question }) => question.wordId)).size, attempts: 0, correct: 0, wrong: 0, completed: 0 };
  for (const { entry } of rows) {
    stats.attempts += entry.attempts;
    stats.correct += entry.correct;
    if (entry.wrong > 0) {
      stats.wrong++;
      if (!entry.active) stats.completed++;
    }
  }
  return stats;
}

export const reviewStatus = (entry) => entry.wrong === 0 ? '오답 없음' : entry.active ? '복습 필요' : '복습 완료';
export const questionType = (question) => question.typing ? '뜻 → 영단어' : QUIZ_TYPES[question.type];

export function groupWrongWords(rows) {
  const words = new Map();
  for (const { question, entry, source } of wrongRows(rows)) {
    const { wordId, word } = question;
    if (!words.has(wordId)) words.set(wordId, { word, source, problems: [] });
    words.get(wordId).problems.push({
      type: questionType(question), answer: question.answers.join(' / '), wrong: entry.wrong, status: reviewStatus(entry),
    });
  }
  return [...words.values()];
}
