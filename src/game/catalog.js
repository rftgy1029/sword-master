export const CARDS = {
  strike: { name: '검의 궤적', kind: '공격', rarity: '일반', cost: 1, damage: 8, icon: '⚔' },
  guard: { name: '돌의 자세', kind: '방어', rarity: '일반', cost: 1, block: 9, icon: '◇' },
  heavy: { name: '균열 베기', kind: '공격', rarity: '일반', cost: 2, damage: 20, icon: '╱' },
  twin: { name: '쌍월', kind: '공격', rarity: '희귀', cost: 1, damage: 5, hits: 2, icon: '☽' },
  heal: { name: '이슬의 숨', kind: '회복', rarity: '희귀', cost: 1, heal: 9, exhaust: true, icon: '✚' },
  empower: { name: '불씨 벼리기', kind: '강화', rarity: '희귀', cost: 1, strength: 2, icon: '♨' },
  weaken: { name: '녹슨 봉인', kind: '약화', rarity: '일반', cost: 1, weak: 2, icon: '⌁' },
  focus: { name: '고요한 응시', kind: '집중', rarity: '일반', cost: 0, focus: 5, icon: '◎' },
  flow: { name: '바람의 손', kind: '방어', rarity: '희귀', cost: 0, block: 4, draw: 2, exhaust: true, icon: '≋' },
  flare: { name: '잿빛 파동', kind: '공격', rarity: '희귀', cost: 2, damage: 16, draw: 2, icon: '✧' },
  nova: { name: '새벽의 낙인', kind: '공격', rarity: '전설', cost: 2, damage: 22, block: 12, icon: '✦' },
  oath: { name: '불멸의 서약', kind: '강화', rarity: '전설', cost: 1, strength: 3, block: 8, exhaust: true, unlock: true, icon: '♜' },
};

export function cardDetails(card) {
  const base = CARDS[card.type];
  const bonus = card.upgraded ? 1 : 0;
  return { ...base,
    damage: base.damage ? base.damage + bonus * (base.hits ? 2 : 4) : 0,
    block: base.block ? base.block + bonus * 4 : 0,
    heal: base.heal ? base.heal + bonus * 4 : 0,
    strength: base.strength ? base.strength + bonus : 0,
    weak: base.weak ? base.weak + bonus : 0,
    focus: base.focus ? base.focus + bonus * 3 : 0,
  };
}

export function describeCard(card) {
  const c = cardDetails(card);
  return [c.damage && `피해 ${c.damage}${c.hits ? ` × ${c.hits}` : ''}`, c.block && `방어 ${c.block}`,
    c.heal && `HP ${c.heal} 회복`, c.strength && `전투 동안 힘 +${c.strength}`,
    c.weak && `약화 ${c.weak}턴 (공격 −25%)`, c.focus && `다음 성공 카드 수치 +${c.focus}`,
    c.draw && `${c.draw}장 뽑기`, c.exhaust && '소멸: 이번 전투에서 한 번'].filter(Boolean).join(' · ');
}

export const RELICS = {
  bastion: { name: '문지기의 돌', icon: '▣', describe: (l) => `전투 시작 시 방어 ${l === 1 ? 6 : 10}.` },
  cadence: { name: '삼박의 종', icon: '♧', describe: (l) => `전투 중 3연속 정답마다 적에게 ${l === 1 ? 6 : 10} 피해.` },
  whetstone: { name: '해뜰녘 숫돌', icon: '◈', describe: (l) => `전투의 첫 공격 카드: 매 타격 피해 +${l === 1 ? 4 : 7}.` },
  echo: { name: '메아리 고리', icon: '∞', describe: (l) => `연속 공격의 두 번째 타격부터 피해 +${l === 1 ? 3 : 5}.` },
  spring: { name: '푸른 샘', icon: '♢', describe: (l) => `매 턴 첫 비공격 카드 성공 시 에너지 1 회복${l === 2 ? ', 카드 1장 뽑기' : ''}.` },
  hearth: { name: '재생의 등불', icon: '♜', describe: (l) => `보스 전투 시작 시 HP ${l === 1 ? 16 : 26} 회복.` },
};

export const NODE_TYPES = {
  battle: { name: '전투', icon: '⚔', hint: '카드 보상 · 금화 25' },
  elite: { name: '강적', icon: '♜', hint: '강한 적 · 카드와 유물 · 금화 45' },
  treasure: { name: '보물', icon: '✦', hint: '유물과 금화 20' },
  rest: { name: '휴식', icon: '♨', hint: 'HP 24 회복 또는 카드 무료 강화' },
  forge: { name: '대장간', icon: '⚒', hint: '카드 강화 30 · 유물 강화 45 · 카드 구입 35' },
  boss: { name: '보스', icon: '♛', hint: '마지막 전투 · 승리 기록과 카드 해금' },
};

export const MONSTERS = {
  crawler: { name: '이끼 발톱', hp: 36, art: 'crawler', pattern: [{ kind: 'attack', value: 7 }, { kind: 'attack', value: 9 }, { kind: 'block', value: 7 }] },
  sentinel: { name: '석문 파수병', hp: 43, art: 'sentinel', pattern: [{ kind: 'block', value: 10 }, { kind: 'attack', value: 11 }, { kind: 'buff', value: 2 }] },
  ember: { name: '불씨 망령', hp: 34, art: 'ember', pattern: [{ kind: 'buff', value: 3 }, { kind: 'attack', value: 12 }, { kind: 'attack', value: 6 }] },
  ravager: { name: '금간 집행자', hp: 66, art: 'sentinel', pattern: [{ kind: 'charge', value: 18 }, { kind: 'attack', value: 18 }, { kind: 'block', value: 12 }, { kind: 'attack', value: 10 }] },
  watcher: { name: '재의 감시자', hp: 62, art: 'ember', pattern: [{ kind: 'attack', value: 10 }, { kind: 'buff', value: 3 }, { kind: 'attack', value: 16 }] },
  boss: { name: '황혼의 수문장', hp: 115, art: 'boss', pattern: [{ kind: 'attack', value: 10 }, { kind: 'block', value: 15 }, { kind: 'buff', value: 2 }, { kind: 'charge', value: 23 }, { kind: 'attack', value: 23 }, { kind: 'attack', value: 13 }] },
};
