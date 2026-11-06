export const ATTACK_DURATION = 2000;
export const ATTACK_HITS = Object.freeze({ strike: [780], heavy: [1000], twin: [700, 1100], flare: [1000], nova: [1100] });
const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
export function attackPose(type, elapsed) {
  const t = Math.max(0, Math.min(ATTACK_DURATION, elapsed));
  const prepare = smooth(t / 500), drive = smooth((t - 500) / 300), recover = smooth((t - 1450) / 550);
  const ranged = type === 'flare' || type === 'nova';
  let arm = -1.35 * prepare + 2.5 * drive;
  if (type === 'twin') arm -= 2.4 * smooth((t - 850) / 170) - 2.5 * smooth((t - 1050) / 210);
  if (type === 'heavy') arm = -1.9 * smooth(t / 650) + 3.6 * smooth((t - 750) / 300);
  return { progress: t / ATTACK_DURATION, arm: arm * (1 - recover),
    advance: (ranged ? .025 : type === 'heavy' ? .13 : .19) * drive * (1 - recover),
    lean: (ranged ? -3 * prepare : -8 * prepare + 17 * drive) * (1 - recover),
    lift: type === 'heavy' ? -10 * Math.sin(Math.PI * clamp((t - 550) / 550)) : 0,
    charge: prepare * (1 - drive), recovery: recover };
}
export function impactsCrossed(type, from, to) {
  return (ATTACK_HITS[type] ?? []).map((time, index) => ({ time, index })).filter(({ time }) => time > from && time <= to);
}
