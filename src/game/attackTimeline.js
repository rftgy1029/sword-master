import { CARD_MOTIONS } from './cardMotions.js';

// 공격 카드의 타격 시점과 길이. 값은 cardMotions.js의 연출 설계에서 가져온다.
export const ATTACK_HITS = Object.freeze(Object.fromEntries(
  Object.entries(CARD_MOTIONS).filter(([, recipe]) => recipe.hits).map(([type, recipe]) => [type, recipe.hits])));
/** 공격 카드의 연출 길이(ms, 타격 정지 제외) */
export const attackDuration = (type) => CARD_MOTIONS[type]?.hits ? CARD_MOTIONS[type].duration : 0;

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/**
 * 간편 화면(2D)용 자세. 팔 각도·전진·기울기를 한 값씩 돌려준다.
 * 3D 장면의 용사는 src/game/three/heroMotion.js가 관절별 자세를 따로 만든다.
 */
export function attackPose(type, elapsed) {
  const recipe = CARD_MOTIONS[type];
  const duration = recipe?.duration ?? 1;
  const t = Math.max(0, Math.min(duration, elapsed));
  const first = recipe?.hits?.[0] ?? duration / 2, last = recipe?.hits?.at(-1) ?? first;
  const windup = recipe?.marks.windup ?? first * .4;
  const back = recipe?.marks.guard ?? (last + (duration - last) * .45);
  const ranged = recipe?.role === 'ranged';
  const prepare = smooth(t / windup), drive = smooth((t - windup) / Math.max(1, first - windup));
  const recover = smooth((t - back) / Math.max(1, duration - back));
  let arm = -1.35 * prepare + 2.5 * drive;
  if (type === 'twin') {
    const turn = recipe.marks.turn;
    // 첫 타격 뒤 검을 다시 들어 올렸다가 두 번째로 내려 벤다.
    arm -= 2.4 * smooth((t - first - 30) / Math.max(1, turn - first - 30)) - 2.5 * smooth((t - turn - 40) / Math.max(1, last - turn - 40));
  }
  if (type === 'heavy') arm = -1.9 * smooth(t / windup) + 3.6 * smooth((t - recipe.marks.apex) / Math.max(1, first - recipe.marks.apex));
  return { progress: t / duration, arm: arm * (1 - recover),
    advance: (ranged ? .025 : type === 'heavy' ? .13 : .19) * drive * (1 - recover),
    lean: (ranged ? -3 * prepare : -8 * prepare + 17 * drive) * (1 - recover),
    lift: type === 'heavy' ? -10 * Math.sin(Math.PI * clamp((t - windup) / Math.max(1, first - windup))) : 0,
    charge: prepare * (1 - drive), recovery: recover };
}

/** from 초과 to 이하에 지나간 타격. 프레임이 건너뛰어도 각 타격이 한 번씩만 나온다. */
export function impactsCrossed(type, from, to) {
  return (ATTACK_HITS[type] ?? []).map((time, index) => ({ time, index })).filter(({ time }) => time > from && time <= to);
}
