const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const easeOut = (value) => 1 - (1 - clamp(value)) ** 3;
const easeIn = (value) => clamp(value) ** 2;

/** 용사와 적이 서 있는 자리 사이의 거리(장면 단위). 3D 장면의 -2.3 ~ 2.3과 같다. */
export const STAGE_GAP = 4.6;

// 몬스터별 공격 모양·색·사거리. reach는 타격 순간 몬스터 중심과 용사 중심 사이의 거리(장면 단위)다.
// 발톱·돌진처럼 몸으로 부딪치는 공격은 가깝게, 무기를 휘두르는 공격은 무기 길이만큼 떨어져서 멈춘다.
const PROFILES = {
  crawler: { style: 'claw', color: 0xc5dc8a, reach: 1.05 }, sentinel: { style: 'blade', color: 0xd8dfbd, reach: 1.5 },
  ember: { style: 'fire', color: 0xffad60 }, bat: { style: 'dive', color: 0xa8e4ef, reach: .85 },
  slime: { style: 'bounce', color: 0x89e2b2, reach: .9 }, mushroom: { style: 'spore', color: 0xe1a6d5 },
  scarab: { style: 'ram', color: 0xe8c07a, reach: 1 }, wisp: { style: 'frost', color: 0xa6e8ff },
  hound: { style: 'claw', color: 0xd49ae6, reach: 1.05 }, ravager: { style: 'slam', color: 0xffa28b, reach: 1.55 },
  watcher: { style: 'fire', color: 0xc8a2ff }, boss: { style: 'slam', color: 0xffd28a, reach: 1.65 },
};
const RANGED = ['fire', 'frost', 'spore'];

/** 적의 방어·강화·강타 준비·숨 고르기 연출의 길이와 효과가 완성되는 시점(ms) */
const ACTIONS = {
  block: { duration: 780, moment: 430, color: 0x9fd6c9 },
  buff: { duration: 900, moment: 520, color: 0xff8f5a },
  charge: { duration: 1000, moment: 760, color: 0xff5a4a },
  wait: { duration: 620, moment: 300, color: 0xa9d6ce },
};

/**
 * 적의 공격 계획.
 * @param {string} type 몬스터 종류
 * @param {{impacts?: number[]}} effect 방어를 뺀 타격별 실제 피해
 * @param {{heavy?: boolean, raw?: number}} [cue] 강타 준비 뒤의 공격인지, 방어 전 타격 피해가 얼마인지(화면이 알려 준다)
 */
export function enemyAttackPlan(type, effect, cue = {}) {
  const profile = PROFILES[type] ?? PROFILES.crawler;
  const { style, color } = profile;
  const heavy = !!cue.heavy;
  const ranged = RANGED.includes(style);
  // 강타는 무기를 들고 빛을 모으는 시간을 길게 주어 긴장을 쌓는다.
  const windup = heavy ? 620 : 300, first = heavy ? 840 : 520, gap = heavy ? 300 : 260;
  const impacts = effect.impacts?.length ? effect.impacts : [effect.amount ?? 0];
  const hits = impacts.map((_, index) => first + index * gap);
  const blocked = impacts.map((amount) => amount === 0);
  return { style, color, hits, heavy, ranged, windup, lunge: heavy ? 210 : 190,
    duration: hits.at(-1) + (heavy ? 660 : 560),
    reach: ranged ? STAGE_GAP : profile.reach, contact: ranged ? 0 : (STAGE_GAP - profile.reach) / STAGE_GAP,
    blocked, partial: impacts.map((amount) => cue.raw > 0 && amount > 0 && amount < cue.raw),
    // 타격 정지: 막아 낸 공격은 방패에 걸리는 느낌으로, 강타는 길게.
    stops: blocked.map((guarded) => guarded ? 36 : heavy ? 70 : 30),
    power: (heavy ? 1.6 : .8) + (style === 'slam' ? .3 : 0) };
}

/** 적의 비공격 행동(방어·강화·강타 준비·숨 고르기) 계획 */
export function enemyActionPlan(type, action) {
  const base = ACTIONS[action] ?? ACTIONS.wait;
  return { style: action, color: action === 'wait' ? (PROFILES[type] ?? PROFILES.crawler).color : base.color,
    duration: base.duration, moment: base.moment, hits: [] };
}

// 하나의 연속된 움직임이 몬스터를 움직인다. 타격별로 따로 만든 움직임이 서로 겹쳐 지워지지 않는다.
export function enemyAttackPose(plan, elapsed) {
  const time = Math.max(0, Math.min(plan.duration, elapsed));
  const first = plan.hits[0], last = plan.hits.at(-1);
  const launch = first - plan.lunge;
  const prepare = smooth(time / plan.windup);
  const drive = easeOut((time - launch) / (plan.lunge - 20));
  const recover = smooth((time - last - 150) / (plan.duration - last - 190));
  const active = 1 - recover;
  // 연속 공격은 타격 사이에 살짝 물러났다가 다시 들어간다.
  let between = 0, swing = easeIn((time - launch) / plan.lunge);
  for (let index = 1; index < plan.hits.length; index += 1) {
    const from = plan.hits[index - 1], to = plan.hits[index];
    if (time > from && time <= to) {
      const s = (time - from) / (to - from);
      between = Math.sin(Math.PI * s);
      swing = s < .45 ? 1 - smooth(s / .45) : easeIn((s - .45) / .55);
    }
  }
  // 맞은 쪽의 반응은 타격 순간에 시작한다(타격 전에 미리 움찔하지 않는다).
  const hit = Math.max(...plan.hits.map((at) => Math.sin(Math.PI * clamp((time - at) / 240))));
  const flight = Math.sin(Math.PI * clamp((time - launch) / (last - launch + 200)));
  const advance = plan.ranged ? -.035 * prepare * active : (-.045 * prepare * (1 - drive) + plan.contact * drive * (1 - .16 * between)) * active;
  const lift = plan.style === 'dive' ? -48 * flight : plan.style === 'bounce' ? -64 * flight : plan.style === 'slam' ? -34 * flight * (plan.heavy ? 1.5 : 1) : 0;
  // 3D 모델의 공격 동작 재생 위치(0~1). 준비 자세(0.3)에서 기다렸다가 타격(0.56)에 맞춰 휘두르고 되돌아온다.
  const clip = time <= last
    ? .3 * prepare + .26 * (time < launch ? 0 : swing)
    : .56 + .44 * smooth((time - last) / (plan.duration - last));
  return { advance, lean: (plan.ranged ? 5 * prepare : 8 * prepare * (1 - drive) - 18 * drive * (1 - .5 * between) + 8 * hit) * active,
    lift, height: -lift / 70,
    recoil: hit, squash: plan.style === 'bounce' ? .18 * hit : .035 * hit,
    prepare: prepare * (1 - drive), strike: drive * active, clip,
    pose: time < plan.windup ? 4 : time <= last + 180 ? 2 : 0 };
}

export function enemyImpactsCrossed(plan, from, to) {
  return plan.hits.map((time, index) => ({ time, index })).filter(({ time }) => time > from && time <= to);
}
