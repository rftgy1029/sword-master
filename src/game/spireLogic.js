import {
  BRONZE_WORDS,
  generateQuestion,
  generateSpireMap,
  MONSTERS,
  POTION_MAP,
  POTIONS,
  RELIC_MAP,
  RELICS,
} from './spireData.js';

export const SPIRE_STORAGE_KEY = 'sword-master.spire-run.v1';
export const SPIRE_MISTAKES_KEY = 'sword-master.spire-mistakes.v1';

// 새 런(Run) 생성
export function createInitialRun() {
  const map = generateSpireMap();
  return {
    hp: 80,
    maxHp: 80,
    shield: 0,
    gold: 50,
    floor: 1,
    relics: ['sharp_blade'], // 시작 유물 1개 기본 지급
    potions: ['potion_lens', 'potion_heal'],
    combo: 0,
    map,
    currentNode: null,
    clearedNodeIds: [],
    mistakes: [],
    battle: null,
    status: 'map', // 'map' | 'battle' | 'reward' | 'shop' | 'rest' | 'event' | 'gameover' | 'victory'
  };
}

// 스토리지 저장 & 로드
export function saveRun(run) {
  try {
    if (!run) {
      localStorage.removeItem(SPIRE_STORAGE_KEY);
      return true;
    }
    localStorage.setItem(SPIRE_STORAGE_KEY, JSON.stringify(run));
    return true;
  } catch {
    return false;
  }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(SPIRE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(SPIRE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// 누적 오답 관리
export function loadMistakes() {
  try {
    const raw = localStorage.getItem(SPIRE_MISTAKES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMistakes(mistakes) {
  try {
    localStorage.setItem(SPIRE_MISTAKES_KEY, JSON.stringify(mistakes));
    return true;
  } catch {
    return false;
  }
}

export function recordMistake(word) {
  const current = loadMistakes();
  if (!current.some((w) => w.id === word.id)) {
    const next = [word, ...current].slice(0, 50); // 최근 50개 유지
    saveMistakes(next);
  }
}

// 전투 시작
export function createBattle(monsterId, run) {
  const template = MONSTERS[monsterId] || MONSTERS.slime;
  const monster = {
    ...template,
    hp: template.maxHp,
    shield: 0,
    turn: 0,
    currentIntent: template.pattern[0],
  };

  // 철갑 방패 유물 효과: 매 전투 시작 시 플레이어 방어도 8
  const initialShield = run.relics.includes('iron_shield') ? 8 : 0;

  // 보스전일 경우 과거 틀렸던 단어 우선 선정
  let targetWord = null;
  if (template.isBoss) {
    const mistakes = loadMistakes();
    if (mistakes.length > 0) {
      targetWord = mistakes[Math.floor(Math.random() * mistakes.length)];
    }
  }

  const question = generateQuestion(targetWord);

  return {
    monster,
    playerShield: initialShield,
    question,
    selectedAction: null, // 'strike' | 'defend' | 'decode'
    turnState: 'player_select', // 'player_select' | 'player_quiz' | 'animating' | 'round_end'
    lastResult: null,
    combatLog: [`${monster.name}이(가) 나타났습니다!`],
  };
}

// 플레이어 행동 처리 (퀴즈 답변 제출 후 결과 판정)
export function resolveTurn({
  run,
  battle,
  actionType, // 'strike' | 'defend' | 'decode'
  isCorrect,
  timeSpentSec = 3,
}) {
  const updatedRun = { ...run, relics: [...run.relics], potions: [...run.potions] };
  const updatedBattle = {
    ...battle,
    monster: { ...battle.monster },
    combatLog: [...battle.combatLog],
  };
  const monster = updatedBattle.monster;

  const result = {
    actionType,
    isCorrect,
    playerDamageDealt: 0,
    playerShieldGained: 0,
    monsterDamageDealt: 0,
    isCritical: false,
    comboReset: false,
    text: '',
  };

  // 1. 플레이어 행동 판정
  if (isCorrect) {
    // 콤보 증가
    updatedRun.combo += 1;

    // 공격력 계산
    if (actionType === 'strike' || actionType === 'decode') {
      let baseDmg = actionType === 'decode' ? 38 : 16;

      // 유물 효과: 예리한 검 (대미지 +4)
      if (updatedRun.relics.includes('sharp_blade')) {
        baseDmg += 4;
      }

      // 유물 효과: 속독의 장화 (5초 이내 답변 시 1.5배)
      if (updatedRun.relics.includes('speed_boots') && timeSpentSec <= 5) {
        baseDmg = Math.round(baseDmg * 1.5);
        result.isCritical = true;
      }

      // 해독검: 방어도 관통
      if (actionType === 'decode') {
        monster.hp = Math.max(0, monster.hp - baseDmg);
        result.playerDamageDealt = baseDmg;
        updatedBattle.combatLog.push(
          `✦ [해독검] 크리티컬 일격! ${monster.name}에게 ${baseDmg}의 관통 대미지를 입혔습니다!`
        );
        updatedRun.combo = 0; // 필살기 사용 후 리셋
      } else {
        // 일반 공격: 방어도 먼저 깎임
        let remainingDmg = baseDmg;
        if (monster.shield > 0) {
          const absorbed = Math.min(monster.shield, remainingDmg);
          monster.shield -= absorbed;
          remainingDmg -= absorbed;
        }
        monster.hp = Math.max(0, monster.hp - remainingDmg);
        result.playerDamageDealt = baseDmg;
        updatedBattle.combatLog.push(
          `⚔️ [타격] 성공! ${monster.name}에게 ${baseDmg} 대미지를 입혔습니다.`
        );
      }
    } else if (actionType === 'defend') {
      // 수비 행동
      let baseShield = 14;
      if (updatedRun.relics.includes('iron_shield')) {
        baseShield += 4;
      }
      updatedBattle.playerShield += baseShield;
      result.playerShieldGained = baseShield;
      updatedBattle.combatLog.push(
        `🛡️ [수비] 성공! 방어도 +${baseShield}를 획득했습니다.`
      );
    }
  } else {
    // 오답 시
    updatedRun.combo = 0;
    result.comboReset = true;
    recordMistake(battle.question.word);
    updatedBattle.combatLog.push(
      `❌ 퀴즈 실패! 정답은 "${battle.question.correctAnswer}" 였습니다.`
    );
  }

  // 2. 적 처치 체크
  if (monster.hp <= 0) {
    updatedBattle.combatLog.push(`🎉 ${monster.name}을(를) 처치했습니다!`);

    // 유물 효과: 흡혈의 송곳니 (처치 시 HP 8 회복)
    if (updatedRun.relics.includes('vampire_fang')) {
      updatedRun.hp = Math.min(updatedRun.maxHp, updatedRun.hp + 8);
      updatedBattle.combatLog.push('🩸 [흡혈의 송곳니] HP 8을 회복했습니다.');
    }

    // 골드 보상 계산
    const [minG, maxG] = monster.goldReward || [20, 30];
    let earnedGold = Math.floor(Math.random() * (maxG - minG + 1)) + minG;
    if (updatedRun.relics.includes('golden_coin')) {
      earnedGold *= 2;
    }
    updatedRun.gold += earnedGold;

    // 보상 획득 상태로 전이
    updatedRun.status = 'reward';
    updatedRun.lastEarnedGold = earnedGold;
    if (updatedRun.currentNode?.id) {
      updatedRun.clearedNodeIds.push(updatedRun.currentNode.id);
    }

    return {
      run: updatedRun,
      battle: updatedBattle,
      result,
      isVictorious: true,
      isDefeated: false,
    };
  }

  // 3. 적의 턴 (적이 공격하거나 방어함)
  const intent = monster.currentIntent;
  if (intent.type === 'attack' || intent.type === 'heavy') {
    let incomingDmg = intent.value;

    // 유물: 학자의 안경 (오답 시 50% 경감)
    if (!isCorrect && updatedRun.relics.includes('scholar_lens')) {
      incomingDmg = Math.round(incomingDmg * 0.5);
    }

    // 플레이어 쉴드로 먼저 흡수
    let actualHpLoss = incomingDmg;
    if (updatedBattle.playerShield > 0) {
      const absorbed = Math.min(updatedBattle.playerShield, incomingDmg);
      updatedBattle.playerShield -= absorbed;
      actualHpLoss -= absorbed;
    }

    updatedRun.hp = Math.max(0, updatedRun.hp - actualHpLoss);
    result.monsterDamageDealt = incomingDmg;
    updatedBattle.combatLog.push(
      `💥 ${monster.name}의 ${intent.description}! ${actualHpLoss > 0 ? `HP -${actualHpLoss}` : '방패로 막음'}`
    );
  } else if (intent.type === 'defend') {
    monster.shield += intent.value;
    updatedBattle.combatLog.push(`🛡️ ${monster.name}이(가) 방어도 +${intent.value}를 충전했습니다.`);
  }

  // 4. 플레이어 사망 체크
  if (updatedRun.hp <= 0) {
    updatedBattle.combatLog.push('💀 용사가 쓰러졌습니다… 게임 오버.');
    updatedRun.status = 'gameover';
    return {
      run: updatedRun,
      battle: updatedBattle,
      result,
      isVictorious: false,
      isDefeated: true,
    };
  }

  // 5. 다음 턴 준비
  monster.turn += 1;
  monster.currentIntent = monster.pattern[monster.turn % monster.pattern.length];
  
  // 다음 문제 준비
  updatedBattle.question = generateQuestion();
  updatedBattle.lastResult = result;
  updatedBattle.turnState = 'player_select';

  // 턴 종료 시 철갑 방패 보너스 갱신
  if (updatedRun.relics.includes('iron_shield')) {
    updatedBattle.playerShield = Math.max(updatedBattle.playerShield, 5);
  }

  return {
    run: updatedRun,
    battle: updatedBattle,
    result,
    isVictorious: false,
    isDefeated: false,
  };
}

// 포션 사용
export function applyPotion(run, battle, potionId) {
  const potionIndex = run.potions.indexOf(potionId);
  if (potionIndex === -1) return { run, battle, success: false };

  const updatedPotions = [...run.potions];
  updatedPotions.splice(potionIndex, 1);
  const updatedRun = { ...run, potions: updatedPotions };
  const updatedBattle = battle
    ? {
        ...battle,
        monster: { ...battle.monster },
        combatLog: [...battle.combatLog],
      }
    : null;

  if (potionId === 'potion_heal') {
    updatedRun.hp = Math.min(updatedRun.maxHp, updatedRun.hp + 25);
    if (updatedBattle) updatedBattle.combatLog.push('💖 [생명의 물약] 체력을 25 회복했습니다!');
  } else if (potionId === 'potion_thunder' && updatedBattle) {
    updatedBattle.monster.hp = Math.max(0, updatedBattle.monster.hp - 22);
    updatedBattle.combatLog.push(`⚡ [번개의 주문서] ${updatedBattle.monster.name}에게 22 대미지!`);
  } else if (potionId === 'potion_lens' && updatedBattle) {
    // 현재 퀴즈에서 오답 2개 제거
    const q = updatedBattle.question;
    const wrongIndices = q.options
      .map((_, i) => i)
      .filter((i) => i !== q.answerIndex);
    // 2개 선택하여 hidden 속성 지정
    updatedBattle.hiddenIndices = wrongIndices.slice(0, 2);
    updatedBattle.combatLog.push('🔍 [집중의 렌즈] 오답 보기 2개를 지웠습니다.');
  }

  return { run: updatedRun, battle: updatedBattle, success: true };
}

// 보상 목록 생성 (골드 + 유물 선택 3종)
export function generateRewards(run) {
  // 소지하지 않은 유물 중 3개 랜덤 추출
  const availableRelics = RELICS.filter((r) => !run.relics.includes(r.id));
  const relicOptions = [...availableRelics].sort(() => 0.5 - Math.random()).slice(0, 3);
  return {
    gold: run.lastEarnedGold || 25,
    relicOptions,
  };
}
