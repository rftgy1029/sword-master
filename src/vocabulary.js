import words from './data/vocabulary.json' with { type: 'json' };

export const TIERS = [
  { id: 'bronze', label: '브론즈', english: 'BRONZE', count: 64 },
  { id: 'silver', label: '실버', english: 'SILVER', count: 290 },
  { id: 'gold', label: '골드', english: 'GOLD', count: 741 },
  { id: 'platinum', label: '플래티넘', english: 'PLATINUM', count: 969 },
  { id: 'master', label: '마스터', english: 'MASTER', count: 1000 },
];

export const PAGE_SIZE = 30;

export function findVocabulary({ tier, scope = 'all', query = '' }) {
  const tierIndex = TIERS.findIndex(({ id }) => id === tier);
  if (tierIndex < 0) return [];
  const allowed = new Set(TIERS.slice(0, tierIndex + 1).map(({ id }) => id));
  const search = query.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  return words.filter((word) => {
    if (scope === 'new' ? word.tier !== tier : !allowed.has(word.tier)) return false;
    return !search || [word.term, word.meaning, word.synonyms, word.antonyms, ...word.sources]
      .join(' ').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').includes(search);
  });
}
