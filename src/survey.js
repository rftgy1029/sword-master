// 사용자 경험 조사(구글폼): 학교 티어를 하나라도 클리어한 학생에게만 타이틀 메뉴에 나타난다.
// 첫 티어가 브론즈이고 다음 티어는 이전 티어 클리어로만 열리므로 "학교 티어 클리어 1회 이상"이 곧 "브론즈 돌파"다.
// 내 단어장 클리어는 학교 범위가 아니므로 세지 않는다.
import { TIERS } from './vocabulary.js';

/**
 * 선생님이 만든 구글폼의 공유 주소를 그대로 붙여 넣는다.
 * 예: 'https://forms.gle/AbCdEf123' 또는 'https://docs.google.com/forms/d/e/…/viewform'
 * 비워 두거나 구글폼이 아닌 주소면 설문 창에 '주소 준비 중'이 표시되고 링크는 열리지 않는다.
 */
export const SURVEY_FORM_URL = '';

/** 설문 버튼을 보여 줄지: 학교 티어 클리어 기록이 한 번이라도 있는가 */
export function surveyUnlocked(progress) {
  const clears = progress?.learning?.clears ?? {};
  return TIERS.some(({ id }) => clears[id] > 0);
}

/** 학교 티어 클리어 횟수의 합. 처음 돌파한 결과 화면에서만 설문 안내를 띄우는 데 쓴다. */
export function schoolClearCount(progress) {
  const clears = progress?.learning?.clears ?? {};
  return TIERS.reduce((sum, { id }) => sum + (clears[id] > 0 ? clears[id] : 0), 0);
}

/** 가장 높은 클리어 티어(없으면 null). 설문 창에서 학생이 자기 기록을 확인하게 한다. */
export function highestClearedTier(progress) {
  const clears = progress?.learning?.clears ?? {};
  return [...TIERS].reverse().find(({ id }) => clears[id] > 0) ?? null;
}

/** 구글폼 주소만 링크로 연다. 오타나 다른 사이트 주소가 학생에게 그대로 열리지 않게 한다. */
export function surveyFormUrl(value = SURVEY_FORM_URL) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const google = url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/');
    const short = url.hostname === 'forms.gle' && url.pathname.length > 1;
    return google || short ? url.href : null;
  } catch {
    return null;
  }
}
