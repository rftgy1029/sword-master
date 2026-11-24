// @ts-check
import { TIERS } from './vocabulary.js';

export const VOCABULARY_VIEW_PARAM = 'view';
export const VOCABULARY_VIEW_VALUE = 'vocabulary';

const VALID_TIERS = new Set(TIERS.map(({ id }) => id));

/**
 * @typedef {Object} VocabularyUrlState
 * @property {boolean} personal
 * @property {string} tier
 * @property {'all' | 'new'} scope
 * @property {string} query
 */

/**
 * URL 검색 쿼리가 독립 단어장 탭 모드인지 판별한다.
 * @param {string} search
 * @returns {boolean}
 */
export function isStandaloneVocabularyUrl(search = '') {
  return new URLSearchParams(search).get(VOCABULARY_VIEW_PARAM) === VOCABULARY_VIEW_VALUE;
}

/**
 * URL 검색 쿼리에서 단어장 초기 보기 상태를 복원한다.
 * @param {string} search
 * @returns {VocabularyUrlState}
 */
export function parseVocabularyUrlState(search = '') {
  const params = new URLSearchParams(search);
  const rawTier = params.get('tier') ?? '';
  return {
    personal: params.get('tab') === 'personal',
    tier: VALID_TIERS.has(rawTier) ? rawTier : 'bronze',
    scope: params.get('scope') === 'new' ? 'new' : 'all',
    query: params.get('q') ?? '',
  };
}

/**
 * 현재 주소를 기준으로 독립 단어장 탭 URL을 만든다.
 * @param {string} currentHref
 * @param {Partial<VocabularyUrlState>} [state]
 * @returns {string}
 */
export function buildVocabularyTabUrl(currentHref, state = {}) {
  const url = new URL(currentHref);
  url.searchParams.set(VOCABULARY_VIEW_PARAM, VOCABULARY_VIEW_VALUE);
  if (state.personal) {
    url.searchParams.set('tab', 'personal');
    url.searchParams.delete('tier');
    url.searchParams.delete('scope');
  } else {
    url.searchParams.delete('tab');
    if (state.tier && VALID_TIERS.has(state.tier)) {
      url.searchParams.set('tier', state.tier);
    } else {
      url.searchParams.delete('tier');
    }
    if (state.scope === 'new') {
      url.searchParams.set('scope', 'new');
    } else {
      url.searchParams.delete('scope');
    }
  }
  const trimmedQuery = state.query?.trim() ?? '';
  if (trimmedQuery) {
    url.searchParams.set('q', trimmedQuery);
  } else {
    url.searchParams.delete('q');
  }
  return url.toString();
}

/**
 * 단어장 전용 쿼리를 제거한 게임 타이틀 URL을 반환한다.
 * @param {string} currentHref
 * @returns {string}
 */
export function buildGameHomeUrl(currentHref) {
  const url = new URL(currentHref);
  for (const key of [VOCABULARY_VIEW_PARAM, 'tab', 'tier', 'scope', 'q']) {
    url.searchParams.delete(key);
  }
  return url.toString();
}
