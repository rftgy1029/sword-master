// 타이틀 메뉴는 클릭·방향키 외에 영어 단어를 쳐서도 고른다. "단어가 무기가 된다"는 게임 콘셉트를 첫 화면에서 보여 준다.

/** 메뉴 순서와 같은 순서의 입력 단어. survey는 학교 티어를 클리어한 뒤에만 선택할 수 있다. */
export const MENU_WORDS = Object.freeze(['start', 'continue', 'words', 'review', 'settings', 'survey']);

/** 메뉴를 고르는 동안 기사가 보이는 반응(용사 모델의 동작 이름). 단어를 끝까지 치면 attack(칼 휘두르기)이다. */
export const MENU_REACTIONS = Object.freeze(['victory', 'walk', 'idle', 'guard', 'idle', 'victory']);

/**
 * 지금까지 친 글자로 메뉴를 찾는다.
 * @param {string} typed 소문자로 모은 입력
 * @param {boolean[]} enabled 메뉴별 선택 가능 여부(기록이 없으면 '이어하기'는 false)
 * @returns {{ index: number, complete: boolean, valid: boolean }}
 *   index: 입력으로 시작하는 첫 메뉴(없으면 -1), complete: 그 단어를 끝까지 쳤는지,
 *   valid: 입력으로 시작하는 단어가 하나라도 있는지(선택할 수 없는 메뉴 포함)
 */
export function matchTyped(typed, enabled = MENU_WORDS.map(() => true)) {
  const text = typed.toLowerCase();
  if (!text) return { index: -1, complete: false, valid: true };
  const valid = MENU_WORDS.some(word => word.startsWith(text));
  const index = MENU_WORDS.findIndex((word, i) => enabled[i] && word.startsWith(text));
  return { index, complete: index >= 0 && MENU_WORDS[index] === text, valid };
}

/**
 * 키 하나를 입력에 반영한다. 어떤 단어로도 이어지지 않는 글자는 새 단어의 첫 글자로 다시 시작한다.
 * @returns {string} 새 입력
 */
export function typeKey(typed, key) {
  if (key === 'Backspace') return typed.slice(0, -1);
  if (key === 'Escape') return '';
  if (!/^[a-z]$/i.test(key)) return typed;
  const next = typed + key.toLowerCase();
  if (MENU_WORDS.some(word => word.startsWith(next))) return next;
  return MENU_WORDS.some(word => word.startsWith(key.toLowerCase())) ? key.toLowerCase() : '';
}
