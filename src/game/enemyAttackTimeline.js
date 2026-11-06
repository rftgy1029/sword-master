const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };

const PROFILES = {
  crawler: ['claw', 0xc5dc8a], sentinel: ['blade', 0xd8dfbd],
  ember: ['fire', 0xffad60], bat: ['dive', 0xa8e4ef],
  slime: ['bounce', 0x89e2b2], mushroom: ['spore', 0xe1a6d5],
  scarab: ['ram', 0xe8c07a], wisp: ['frost', 0xa6e8ff],
  hound: ['claw', 0xd49ae6], ravager: ['slam', 0xffa28b],
  watcher: ['fire', 0xc8a2ff], boss: ['slam', 0xffd28a],
};

export function enemyAttackPlan(type, effect) {
  const [style, color] = PROFILES[type] ?? PROFILES.crawler;
  const hits = Array.from({ length: effect.impacts?.length || 1 }, (_, index) => 760 + index * 360);
  return { style, color, hits, duration: hits.at(-1) + 820,
    ranged: ['fire', 'frost', 'spore'].includes(style) };
}

// One continuous motion owns the actors; overlapping per-hit tweens cannot cancel it.
export function enemyAttackPose(plan, elapsed) {
  const time = Math.max(0, Math.min(plan.duration, elapsed));
  const last = plan.hits.at(-1), prepare = smooth(time / 420);
  const drive = smooth((time - 420) / 340), recover = smooth((time - last - 180) / 640);
  const active = 1 - recover;
  const hit = Math.max(...plan.hits.map((at) => Math.sin(Math.PI * clamp((time - at + 100) / 240))));
  const flight = Math.sin(Math.PI * clamp((time - 420) / (last - 420 + 220)));
  return { advance: (plan.ranged ? -.035 * prepare : -.045 * prepare + .87 * drive) * active,
    lean: (plan.ranged ? 5 * prepare : 8 * prepare - 18 * drive + 8 * hit) * active,
    lift: plan.style === 'dive' ? -48 * flight : plan.style === 'bounce' ? -64 * flight : plan.style === 'slam' ? -34 * flight : 0,
    recoil: hit, squash: plan.style === 'bounce' ? .18 * hit : .035 * hit,
    pose: time < 420 ? 4 : time <= last + 180 ? 2 : 0 };
}

export function enemyImpactsCrossed(plan, from, to) {
  return plan.hits.map((time, index) => ({ time, index })).filter(({ time }) => time > from && time <= to);
}
