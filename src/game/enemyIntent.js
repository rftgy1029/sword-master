import { enemyDamageImpacts } from './engine.js';

/**
 * 적의 다음 행동(intentFor 결과)을 플레이어 관점의 유불리·예상 피해·상세 설명으로 정리한다.
 * 전투 규칙(engine.js)의 피해 계산을 그대로 사용한다.
 */
export function describeEnemyIntent(intent, { playerBlock = 0, playerHp = 0, acting = false } = {}) {
  if (!intent) return null;
  const timing = acting ? '진행 중' : '다음 행동';
  const block = Math.max(0, playerBlock);
  const noDamage = { total: 0, blocked: 0, hpLoss: 0, blockedAll: false, fatal: false };

  if (intent.kind === 'attack') {
    const hits = intent.hits ?? 1;
    const total = intent.value * hits;
    const impacts = enemyDamageImpacts(intent, block);
    const hpLoss = impacts.reduce((sum, hit) => sum + hit, 0);
    const blocked = total - hpLoss;
    const blockedAll = hpLoss === 0;
    const fatal = playerHp > 0 && hpLoss >= playerHp;
    const title = `공격 ${intent.value}${hits > 1 ? ` × ${hits}` : ''}`;

    const stance = blockedAll ? '방어됨' : fatal ? '치명' : '위협';
    const tone = blockedAll ? 'guarded' : fatal ? 'fatal' : 'threat';
    const summary = blockedAll
      ? '모두 막음 · 피해 0'
      : fatal
        ? `HP -${hpLoss} 치명`
        : blocked > 0
          ? `방어 후 HP -${hpLoss}`
          : `HP -${hpLoss} 예상`;

    const verdict = total === 0
      ? '약화 상태라 이번 공격 피해가 0입니다.'
      : blockedAll
        ? `안전 · 현재 방어(${block})로 피해 ${total}을 모두 막습니다.`
        : fatal
          ? `치명적 피해 · 이대로 맞으면 HP(${playerHp})가 모두 깎입니다.`
          : blocked > 0
            ? `피해 예고 · 방어 ${block}이 ${blocked}을 막고 HP가 ${hpLoss} 줄어듭니다.`
            : `피해 예고 · 방어 없이 맞으면 HP가 ${hpLoss} 줄어듭니다.`;

    const hitDetail = hits > 1 ? `총 ${hits}회 타격(합계 ${total}). ` : '';
    const tip = blockedAll
      ? '이번 턴엔 추가 방어 없이 공격·강화 카드를 쓰기 좋습니다.'
      : `${hitDetail}방어·약화 카드로 피해를 줄이거나 먼저 처치하세요.`;

    return {
      kind: intent.kind,
      icon: 'strike',
      timing,
      stance,
      tone,
      title,
      summary,
      damage: { total, blocked, hpLoss, blockedAll, fatal },
      tooltip: { title: `적 공격 · ${title}`, verdict, tip },
      ariaLabel: `${timing}: ${title}, ${stance}, ${summary}`,
    };
  }

  if (intent.kind === 'charge') {
    const title = '강타 준비';
    const summary = `피해 0 · 다음 강타 ${intent.value}`;
    return {
      kind: intent.kind,
      icon: 'heavy',
      timing,
      stance: '경고',
      tone: 'warning',
      title,
      summary,
      damage: noDamage,
      tooltip: {
        title: `강타 준비 · 다음 기본 피해 ${intent.value}`,
        verdict: `이번 턴 피해 없음 · 다음 적 행동에 기본 피해 ${intent.value}의 강타가 옵니다.`,
        tip: '내 방어는 턴이 끝나면 사라지므로, 이번 턴엔 방어 대신 공격·약화·집중을 준비하세요.',
      },
      ariaLabel: `${timing}: ${title}, 경고, ${summary}`,
    };
  }

  if (intent.kind === 'buff') {
    const title = `힘 +${intent.value}`;
    const summary = `피해 0 · 적 공격 +${intent.value}`;
    return {
      kind: intent.kind,
      icon: 'empower',
      timing,
      stance: '주의',
      tone: 'warning',
      title,
      summary,
      damage: noDamage,
      tooltip: {
        title: `적 강화 · ${title}`,
        verdict: `이번 턴 피해 없음 · 전투 동안 적의 매 공격 타격 피해가 +${intent.value} 늘어납니다.`,
        tip: '지금은 맞지 않으니 빠르게 공격하거나 약화로 다음 공격에 대비하세요.',
      },
      ariaLabel: `${timing}: ${title}, 주의, ${summary}`,
    };
  }

  if (intent.kind === 'block') {
    const title = `적 방어 +${intent.value}`;
    const summary = '피해 0 · 다음 턴 방어막';
    return {
      kind: intent.kind,
      icon: 'guard',
      timing,
      stance: '주의',
      tone: 'warning',
      title,
      summary,
      damage: noDamage,
      tooltip: {
        title,
        verdict: `이번 턴 피해 없음 · 턴이 끝나면 적이 방어 ${intent.value}을 얻어 다음 내 턴 공격을 막습니다.`,
        tip: '이번 턴엔 방어가 필요 없으며, 적이 방어를 얻기 전에 먼저 공격하기 좋습니다.',
      },
      ariaLabel: `${timing}: ${title}, 주의, ${summary}`,
    };
  }

  const title = '숨 고르기';
  const summary = '피해 0 · 공격 찬스';
  return {
    kind: intent.kind,
    icon: 'flow',
    timing,
    stance: '기회',
    tone: 'opportunity',
    title,
    summary,
    damage: noDamage,
    tooltip: {
      title: '숨 고르기 · 행동 없음',
      verdict: '내게 유리한 기회 · 공격·방어·강화·회복을 전혀 하지 않고 차례를 넘깁니다.',
      tip: '방어 카드 없이 공격·회복·강화 카드를 쓰기 가장 좋은 턴입니다.',
    },
    ariaLabel: `${timing}: ${title}, 기회, ${summary}`,
  };
}
