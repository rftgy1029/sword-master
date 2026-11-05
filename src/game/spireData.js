import vocabulary from '../data/vocabulary.json' with { type: 'json' };

export const BRONZE_WORDS = vocabulary.filter((word) => word.tier === 'bronze');

// 64개 단어 ID 매핑
export const BRONZE_MAP = new Map(BRONZE_WORDS.map((w) => [w.id, w]));

// 유물 목록
export const RELICS = [
  {
    id: 'sharp_blade',
    name: '예리한 검',
    icon: '🗡️',
    description: '공격 시 추가 대미지 +4를 줍니다.',
    price: 60,
  },
  {
    id: 'iron_shield',
    name: '철갑 방패',
    icon: '🛡️',
    description: '매 턴 시작 시 방어도 5를 자동으로 얻습니다.',
    price: 65,
  },
  {
    id: 'scholar_lens',
    name: '학자의 안경',
    icon: '👓',
    description: '퀴즈 오답 시 적에게 받는 피해를 50% 경감합니다.',
    price: 70,
  },
  {
    id: 'speed_boots',
    name: '속독의 장화',
    icon: '👢',
    description: '5초 이내에 정답을 맞히면 대미지가 1.5배가 됩니다.',
    price: 75,
  },
  {
    id: 'combo_gem',
    name: '연속의 보석',
    icon: '💎',
    description: '2연속 정답만으로 필살기 해독검이 충전됩니다.',
    price: 80,
  },
  {
    id: 'golden_coin',
    name: '황금 주머니',
    icon: '💰',
    description: '전투 승리 시 획득하는 골드가 2배가 됩니다.',
    price: 55,
  },
  {
    id: 'vampire_fang',
    name: '흡혈의 송곳니',
    icon: '🩸',
    description: '몬스터 처치 시 체력 8을 회복합니다.',
    price: 75,
  },
  {
    id: 'ancient_tome',
    name: '고대의 고서',
    icon: '📜',
    description: '전투 시작 시 최대 체력이 10 증가하고 10 회복합니다.',
    price: 70,
  },
];

export const RELIC_MAP = new Map(RELICS.map((r) => [r.id, r]));

// 포션 목록
export const POTIONS = [
  {
    id: 'potion_heal',
    name: '생명의 물약',
    icon: '💖',
    description: '체력을 25 회복합니다.',
    price: 35,
  },
  {
    id: 'potion_lens',
    name: '집중의 렌즈',
    icon: '🔍',
    description: '현재 문제에서 오답 보기 2개를 즉시 지웁니다.',
    price: 40,
  },
  {
    id: 'potion_thunder',
    name: '번개의 주문서',
    icon: '⚡',
    description: '적에게 방어도를 관통하는 22 대미지를 줍니다.',
    price: 45,
  },
];

export const POTION_MAP = new Map(POTIONS.map((p) => [p.id, p]));

// 몬스터 프리셋
export const MONSTERS = {
  slime: {
    id: 'slime',
    name: '동굴 슬라임',
    sprite: 'slime',
    maxHp: 32,
    goldReward: [18, 25],
    pattern: [
      { type: 'attack', value: 8, description: '몸통 박치기 (8 대미지)' },
      { type: 'attack', value: 10, description: '점액 발사 (10 대미지)' },
      { type: 'defend', value: 8, description: '몸체 굳히기 (방어도 8)' },
      { type: 'heavy', value: 14, description: '대형 점액 강타 (14 대미지)' },
    ],
  },
  bat: {
    id: 'bat',
    name: '던전 박쥐',
    sprite: 'bat',
    maxHp: 28,
    goldReward: [20, 28],
    pattern: [
      { type: 'attack', value: 9, description: '초음파 공격 (9 대미지)' },
      { type: 'defend', value: 10, description: '날갯짓 회피 (방어도 10)' },
      { type: 'attack', value: 12, description: '흡혈 돌진 (12 대미지)' },
    ],
  },
  goblin: {
    id: 'goblin',
    name: '고블린 검사',
    sprite: 'goblin',
    maxHp: 46,
    goldReward: [25, 35],
    pattern: [
      { type: 'attack', value: 11, description: '단검 찌르기 (11 대미지)' },
      { type: 'defend', value: 9, description: '나무 방패 (방어도 9)' },
      { type: 'heavy', value: 17, description: '기습 베기 (17 대미지)' },
    ],
  },
  gargoyle: {
    id: 'gargoyle',
    name: '흑요석 가고일',
    sprite: 'gargoyle',
    maxHp: 52,
    goldReward: [30, 42],
    pattern: [
      { type: 'defend', value: 14, description: '석화 피부 (방어도 14)' },
      { type: 'attack', value: 13, description: '발톱 할퀴기 (13 대미지)' },
      { type: 'heavy', value: 19, description: '돌진 강타 (19 대미지)' },
    ],
  },
  skeleton_knight: {
    id: 'skeleton_knight',
    name: '저주받은 해골 기사',
    sprite: 'skeleton',
    maxHp: 68,
    isElite: true,
    goldReward: [45, 60],
    pattern: [
      { type: 'attack', value: 15, description: '녹슨 검격 (15 대미지)' },
      { type: 'defend', value: 14, description: '원혼의 방패 (방어도 14)' },
      { type: 'heavy', value: 22, description: '영혼 절단 (22 대미지!)' },
      { type: 'attack', value: 17, description: '연속 베기 (17 대미지)' },
    ],
  },
  abyssal_shade: {
    id: 'abyssal_shade',
    name: '심연의 그림자',
    sprite: 'shade',
    maxHp: 64,
    isElite: true,
    goldReward: [45, 60],
    pattern: [
      { type: 'attack', value: 16, description: '그림자 채찍 (16 대미지)' },
      { type: 'defend', value: 15, description: '어둠의 장막 (방어도 15)' },
      { type: 'heavy', value: 24, description: '공포의 폭풍 (24 대미지!)' },
    ],
  },
  boss_golem: {
    id: 'boss_golem',
    name: '고대 언어의 골렘',
    sprite: 'golem',
    maxHp: 110,
    isBoss: true,
    goldReward: [80, 100],
    pattern: [
      { type: 'defend', value: 18, description: '고대 룬 방벽 (방어도 18)' },
      { type: 'attack', value: 16, description: '바위 주먹 (16 대미지)' },
      { type: 'heavy', value: 26, description: '대지의 파멸 (26 대미지!)' },
      { type: 'attack', value: 18, description: '파편 폭발 (18 대미지)' },
      { type: 'defend', value: 15, description: '수호 에너지 충전 (방어도 15)' },
    ],
  },
};

// 맵 생성 함수 (8층 Spire)
export function generateSpireMap() {
  // 1층: 슬라임 또는 박쥐 (일반)
  // 2층: 일반 전투 또는 미지의 방
  // 3층: 일반 전투 또는 상점
  // 4층: 엘리트 전투
  // 5층: 휴식처 (캠프)
  // 6층: 일반 전투 또는 상점
  // 7층: 휴식처 (보스 직전 정비)
  // 8층: 보스 (고대 골렘)
  return [
    {
      floor: 1,
      nodes: [
        { id: 'f1-1', type: 'battle', monsterId: 'slime', name: '동굴 슬라임' },
        { id: 'f1-2', type: 'battle', monsterId: 'bat', name: '던전 박쥐' },
      ],
    },
    {
      floor: 2,
      nodes: [
        { id: 'f2-1', type: 'battle', monsterId: 'goblin', name: '고블린 검사' },
        { id: 'f2-2', type: 'event', name: '신비한 사원' },
      ],
    },
    {
      floor: 3,
      nodes: [
        { id: 'f3-1', type: 'battle', monsterId: 'gargoyle', name: '흑요석 가고일' },
        { id: 'f3-2', type: 'shop', name: '모험가 상점' },
      ],
    },
    {
      floor: 4,
      nodes: [
        { id: 'f4-1', type: 'elite', monsterId: 'skeleton_knight', name: '해골 기사' },
        { id: 'f4-2', type: 'elite', monsterId: 'abyssal_shade', name: '심연의 그림자' },
      ],
    },
    {
      floor: 5,
      nodes: [
        { id: 'f5-1', type: 'rest', name: '모닥불 휴식처' },
      ],
    },
    {
      floor: 6,
      nodes: [
        { id: 'f6-1', type: 'battle', monsterId: 'gargoyle', name: '강화 가고일' },
        { id: 'f6-2', type: 'shop', name: '비밀 상점' },
      ],
    },
    {
      floor: 7,
      nodes: [
        { id: 'f7-1', type: 'rest', name: '보스 직전의 성소' },
      ],
    },
    {
      floor: 8,
      nodes: [
        { id: 'f8-1', type: 'boss', monsterId: 'boss_golem', name: '고대 언어의 골렘' },
      ],
    },
  ];
}

// 4지선다 문제 생성기
export function generateQuestion(targetWord, mistakeIds = [], seed = Math.random()) {
  const word = targetWord || BRONZE_WORDS[Math.floor(seed * BRONZE_WORDS.length)];
  
  // 문제 유형 결정: 뜻(70%), 유의어(15%), 반의어(15%)
  let type = 'meaning';
  const hasSyn = word.synonyms && word.synonyms !== '—' && !word.synonyms.includes('[상대어]');
  const hasAnt = word.antonyms && word.antonyms !== '—' && !word.antonyms.includes('[상대어]');

  const typeRoll = Math.random();
  if (typeRoll < 0.65 || (!hasSyn && !hasAnt)) {
    type = 'meaning';
  } else if (typeRoll < 0.85 && hasSyn) {
    type = 'synonyms';
  } else if (hasAnt) {
    type = 'antonyms';
  }

  let prompt = '';
  let correctAnswer = '';

  if (type === 'meaning') {
    prompt = `단어 "${word.term}"의 올바른 뜻은?`;
    correctAnswer = word.meaning;
  } else if (type === 'synonyms') {
    prompt = `단어 "${word.term}"의 유의어로 알맞은 것은?`;
    correctAnswer = word.synonyms.replace(/[①②③④⑤]/g, '').trim();
  } else {
    prompt = `단어 "${word.term}"의 반의어로 알맞은 것은?`;
    correctAnswer = word.antonyms.replace(/[①②③④⑤]/g, '').trim();
  }

  // 오답 보기 3개 추출 (같은 필드 기준)
  const otherWords = BRONZE_WORDS.filter((w) => w.id !== word.id);
  // 셔플
  const shuffledOthers = [...otherWords].sort(() => 0.5 - Math.random());

  const distractors = [];
  for (const candidate of shuffledOthers) {
    let distractor = '';
    if (type === 'meaning') {
      distractor = candidate.meaning;
    } else if (type === 'synonyms') {
      if (candidate.synonyms && candidate.synonyms !== '—') {
        distractor = candidate.synonyms.replace(/[①②③④⑤]/g, '').trim();
      } else {
        distractor = candidate.meaning;
      }
    } else {
      if (candidate.antonyms && candidate.antonyms !== '—') {
        distractor = candidate.antonyms.replace(/[①②③④⑤]/g, '').trim();
      } else {
        distractor = candidate.meaning;
      }
    }

    if (distractor && distractor !== correctAnswer && !distractors.includes(distractor)) {
      distractors.push(distractor);
      if (distractors.length >= 3) break;
    }
  }

  // 4개 보기 섞기
  const options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
  const answerIndex = options.indexOf(correctAnswer);

  return {
    word,
    type,
    prompt,
    options,
    answerIndex,
    correctAnswer,
  };
}
