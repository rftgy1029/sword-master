// 카드 12종의 연출 설계. 색·길이·타격 시점·타격 정지·단계 표시를 한곳에 둔다.
// 3D 장면(src/game/three), 간편 화면(src/game/combatScene.js), 효과음(src/game/audio)이 모두 이 표를 읽는다.
//
// 시간은 모두 ms이고 '연출 시간표' 기준이다. 타격 정지(hitStop)로 화면이 멈춘 시간은 포함하지 않으므로
// 실제 재생 시간은 duration + hitStop의 합이다(realDuration).
// 모든 카드는 준비(windup) → 발동 → 타격(hits) 또는 효과 완성(moment) → 잔향 → 복귀 순서로 흐른다.
//
// role: melee(달려가 벤다) · ranged(제자리에서 쏜다) · self(용사에게 거는 효과) · curse(적에게 거는 효과)
// power: 타격의 세기. 1이 기본 베기이며 카메라 반응·불꽃 수·적의 밀려남에 곱한다.
// swings: 검 잔상을 그리는 구간 [시작, 끝, 색 번호]. 구간이 바뀌면 잔상을 끊는다.
export const CARD_MOTIONS = Object.freeze({
  strike: { style: 'slash', role: 'melee', color: 0xffe5a5, accent: 0xffa63d, core: 0xfff7e0,
    duration: 840, hits: [400], hitStop: [50], power: [1],
    marks: { windup: 150, plant: 335, follow: 480, guard: 560, leap: 600, land: 780 }, swings: [[338, 490, 0]] },
  heavy: { style: 'fracture', role: 'melee', color: 0xffb45b, accent: 0xff6a1f, core: 0xfff0c8,
    duration: 1300, hits: [700], hitStop: [95], power: [1.9],
    marks: { raise: 140, windup: 400, apex: 560, plant: 700, follow: 900, guard: 1020, leap: 1050, land: 1240 }, swings: [[610, 712, 0]] },
  twin: { style: 'moons', role: 'melee', color: 0x8fd0ff, accent: 0xc59bff, core: 0xf2f4ff,
    duration: 1260, hits: [420, 650], hitStop: [40, 60], power: [.85, 1.25],
    marks: { windup: 160, plant: 335, turn: 505, follow: 745, guard: 920, leap: 960, land: 1180 }, swings: [[338, 505, 0], [566, 748, 1]] },
  flare: { style: 'wave', role: 'ranged', color: 0xd6bcff, accent: 0x9a8cff, core: 0xfbf4ff,
    duration: 1150, hits: [640], hitStop: [45], power: [1.15],
    marks: { windup: 360, launch: 420, follow: 500, guard: 900 }, swings: [[366, 486, 0]] },
  nova: { style: 'dawn', role: 'ranged', color: 0xffdd86, accent: 0xff9d5c, core: 0xfffbe6,
    duration: 1700, hits: [800], hitStop: [90], power: [2.2],
    marks: { raise: 200, windup: 650, hush: 650, launch: 745, linger: 1250 }, swings: [[745, 812, 0]] },
  guard: { style: 'stone', role: 'self', color: 0xb7d4a1, accent: 0x7fe3c4, core: 0xf2ffe6,
    duration: 950, moment: 700, marks: { brace: 200, rise: 200, join: 560 } },
  heal: { style: 'dew', role: 'self', color: 0x8bffce, accent: 0xffd9ec, core: 0xfffbe2,
    duration: 1050, moment: 760, marks: { bloom: 250, gather: 620 } },
  empower: { style: 'embers', role: 'self', color: 0xff9155, accent: 0xffd27a, core: 0xfff1d6,
    duration: 1000, moment: 520, marks: { ignite: 120, land: 610 } },
  weaken: { style: 'seal', role: 'curse', color: 0xc9a56b, accent: 0x7a55a8, core: 0xffe9c4,
    duration: 1000, moment: 620, marks: { cast: 250, bind: 250 } },
  focus: { style: 'focus', role: 'self', color: 0xc8e5ff, accent: 0x6fb6ff, core: 0xffffff,
    duration: 900, moment: 560, marks: { still: 220 } },
  flow: { style: 'wind', role: 'self', color: 0x9ee8df, accent: 0x58d6c0, core: 0xf0fffb,
    duration: 850, moment: 420, marks: { spin: 80, land: 600 }, swings: [[90, 590, 0]] },
  oath: { style: 'oath', role: 'self', color: 0xffefbd, accent: 0xffc94d, core: 0xfffaf0,
    duration: 1350, moment: 900, marks: { crest: 400, descend: 780, hold: 1150 } },
});

/** 오답: 준비하던 힘이 흩어지는 짧은 연출 */
export const MISS_DURATION = 520;
/** 강화 카드는 타격 정지가 조금 더 길다 */
export const UPGRADE_STOP = 10;

/** 타격 정지까지 더한 실제 재생 시간(ms) */
export function realDuration(type, upgraded = false) {
  const recipe = CARD_MOTIONS[type];
  if (!recipe) return 0;
  return recipe.duration + (recipe.hitStop ?? []).reduce((sum, stop) => sum + stop + (upgraded ? UPGRADE_STOP : 0), 0);
}
