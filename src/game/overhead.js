// 전장 캐릭터 머리 위에 띄우는 의도·지속 효과 표시용 데이터.
// 전투 상태를 읽기만 하고 규칙은 바꾸지 않는다. 수치는 HUD(StatusBadges)·intentFor()와 같은 값을 쓴다.

const INTENTS = {
  attack: { icon: 'strike', label: '공격', tone: 'attack' },
  block: { icon: 'guard', label: '방어', tone: 'block' },
  buff: { icon: 'empower', label: '힘', tone: 'buff' },
  charge: { icon: 'heavy', label: '강타 준비', tone: 'charge' },
  wait: { icon: 'flow', label: '숨 고르기', tone: 'wait' },
};

/** 적의 다음 행동(intentFor 결과)을 짧은 머리 위 표시로 바꾼다. */
export function overheadIntent(intent) {
  if (!intent) return null;
  const base = INTENTS[intent.kind] ?? { icon: 'spark', label: intent.label ?? '행동', tone: 'wait' };
  const value = intent.kind === 'attack' ? `${intent.value}${intent.hits ? `×${intent.hits}` : ''}`
    : intent.kind === 'block' ? `+${intent.value}`
      : intent.kind === 'buff' ? `+${intent.value}`
        : '';
  const detail = intent.kind === 'charge' ? `다음 피해 ${intent.value}` : '';
  return { kind: intent.kind, ...base, value, detail };
}

/** 머리 위에 표시할 지속 효과 목록. hero는 용사, enemy는 적. 값이 0이면 뺀다. */
export function overheadStatuses(battle, side) {
  const state = side === 'enemy' ? battle.enemy : battle;
  const list = [];
  if (state.block > 0) list.push({ id: 'block', icon: 'guard', label: '방어', value: state.block, text: `${state.block}`, tone: 'guard' });
  if (state.strength > 0) list.push({ id: 'strength', icon: 'empower', label: '힘', value: state.strength, text: `+${state.strength}`, tone: 'power' });
  if (side === 'enemy' && state.weak > 0) list.push({ id: 'weak', icon: 'weaken', label: '약화', value: state.weak, text: `${state.weak}턴`, tone: 'harm' });
  if (side !== 'enemy' && state.focus > 0) list.push({ id: 'focus', icon: 'focus', label: '집중', value: state.focus, text: `+${state.focus}`, tone: 'focus' });
  return list;
}

/** 이전 표시와 비교해 늘어난 효과의 증가량을 { id: 증가량 }으로 돌려준다. */
export function statusGains(previous = [], next = []) {
  const before = Object.fromEntries(previous.map((item) => [item.id, item.value]));
  const gains = {};
  for (const item of next) {
    const gain = item.value - (before[item.id] ?? 0);
    if (gain > 0) gains[item.id] = gain;
  }
  return gains;
}

/** 화면 좌표(client px)를 오버레이 상자 기준 백분율로 바꾸고 화면 밖으로 나가지 않게 자른다. */
export function anchorPercent(point, box, { minTop = 64 } = {}) {
  if (!point || !box?.width || !box?.height || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const left = (point.x - box.left) / box.width * 100;
  const top = (Math.max(point.y - box.top, Math.min(minTop, box.height * .5))) / box.height * 100;
  return { left: Math.min(92, Math.max(8, left)), top: Math.min(92, Math.max(0, top)) };
}
