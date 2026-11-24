// @ts-check
import { CARDS, cardDetails } from './catalog.js';
import { intentFor } from './engine.js';
import { describeEnemyIntent } from './enemyIntent.js';

const relicLevel = (run, id) => run?.relics?.find((r) => r.id === id)?.level ?? 0;

/**
 * @typedef {{ enemyHp?: number, playerHp?: number, playerBlock?: number }} PreviewOverrides
 * @typedef {{ kind: 'guard' | 'heal' | 'power' | 'focus' | 'draw' | 'energy', text: string }} HeroBadge
 * @typedef {{ text: string, boosted: boolean, muted?: boolean }} CardEffectPart
 */

/**
 * 전투 중 손패 카드를 성공적으로 발동했을 때의 예상 결과를 engine.js와 같은 규칙으로 계산한다.
 * 실제 전투 상태(run)는 변경하지 않는다.
 * @param {any} run
 * @param {{ uid?: string, type: keyof typeof CARDS, upgraded?: boolean } | null | undefined} card
 * @param {PreviewOverrides} [overrides]
 */
export function previewCardPlay(run, card, overrides = {}) {
  const b = run?.battle;
  if (!b || !card) return null;
  const c = cardDetails(card);
  const focus = c.focus ? 0 : b.focus;
  const currentEnemyHp = overrides.enemyHp ?? b.enemy.hp;
  const currentPlayerHp = overrides.playerHp ?? run.hp;
  const currentBlock = overrides.playerBlock ?? b.block;
  let simEnemyBlock = b.enemy.block;
  let simEnemyHp = currentEnemyHp;

  let rawDamage = 0;
  let hpDamage = 0;
  const hitDamages = [];
  const firstBonus = c.damage && b.firstAttack && relicLevel(run, 'whetstone')
    ? (relicLevel(run, 'whetstone') === 1 ? 4 : 7)
    : 0;
  const echoBonus = c.damage && (c.hits ?? 1) > 1 && relicLevel(run, 'echo')
    ? (relicLevel(run, 'echo') === 1 ? 3 : 5)
    : 0;

  if (c.damage) {
    const hits = c.hits ?? 1;
    for (let i = 0; i < hits; i++) {
      const hitRaw = c.damage + b.strength + focus + firstBonus + (i > 0 ? echoBonus : 0);
      rawDamage += hitRaw;
      hitDamages.push(hitRaw);
      const absorbed = Math.min(simEnemyBlock, hitRaw);
      simEnemyBlock -= absorbed;
      const dealt = Math.min(simEnemyHp, hitRaw - absorbed);
      simEnemyHp -= dealt;
      hpDamage += dealt;
    }
  }

  const cadenceLevel = relicLevel(run, 'cadence');
  const cadenceBonus = cadenceLevel && (b.streak + 1) % 3 === 0
    ? (cadenceLevel === 1 ? 6 : 10)
    : 0;
  if (cadenceBonus > 0) {
    rawDamage += cadenceBonus;
    const absorbed = Math.min(simEnemyBlock, cadenceBonus);
    simEnemyBlock -= absorbed;
    const dealt = Math.min(simEnemyHp, cadenceBonus - absorbed);
    simEnemyHp -= dealt;
    hpDamage += dealt;
  }

  const blockGain = c.block ? c.block + focus : 0;
  const healGain = c.heal ? Math.min(run.maxHp - currentPlayerHp, c.heal + focus) : 0;
  const healTotal = c.heal ? c.heal + focus : 0;
  const strengthGain = c.strength ? c.strength + focus : 0;
  const weakGain = c.weak ? c.weak + focus : 0;
  const focusGain = c.focus || 0;
  const springLevel = !c.damage && !b.springUsed ? relicLevel(run, 'spring') : 0;
  const energyGain = springLevel ? 1 : 0;
  const drawGain = (c.draw ?? 0) + (springLevel === 2 ? 1 : 0);

  const playerBlockAfter = currentBlock + blockGain;
  const playerHpAfter = currentPlayerHp + healGain;
  const enemyHpAfter = simEnemyHp;
  const lethal = currentEnemyHp > 0 && enemyHpAfter === 0;
  const energyAfter = Math.max(0, b.energy - c.cost) + energyGain;

  const currentIntent = intentFor(b.enemy);
  const currentIntentView = describeEnemyIntent(currentIntent, {
    playerBlock: currentBlock,
    playerHp: currentPlayerHp,
  });

  const nextEnemy = { ...b.enemy, weak: b.enemy.weak + weakGain };
  const nextIntent = intentFor(nextEnemy);
  const nextIntentView = describeEnemyIntent(nextIntent, {
    playerBlock: playerBlockAfter,
    playerHp: playerHpAfter,
  });

  const intentChanged = Boolean(
    lethal ||
    (currentIntentView && nextIntentView && (
      currentIntentView.title !== nextIntentView.title ||
      currentIntentView.summary !== nextIntentView.summary ||
      currentIntentView.stance !== nextIntentView.stance
    ))
  );

  const boosted = {
    damage: Boolean(c.damage && (b.strength > 0 || focus > 0 || firstBonus > 0 || echoBonus > 0)),
    block: Boolean(c.block && focus > 0),
    heal: Boolean(c.heal && focus > 0),
    strength: Boolean(c.strength && focus > 0),
    weak: Boolean(c.weak && focus > 0),
  };

  /** @type {HeroBadge[]} */
  const heroBadges = /** @type {HeroBadge[]} */ ([
    blockGain > 0 && { kind: 'guard', text: `방어 +${blockGain}` },
    healGain > 0 && { kind: 'heal', text: `HP +${healGain}` },
    strengthGain > 0 && { kind: 'power', text: `힘 +${strengthGain}` },
    focusGain > 0 && { kind: 'focus', text: `집중 +${focusGain}` },
    drawGain > 0 && { kind: 'draw', text: `+${drawGain}장` },
    energyGain > 0 && { kind: 'energy', text: `에너지 +${energyGain}` },
  ].filter(Boolean));

  return {
    card,
    cost: c.cost,
    energyAfter,
    rawDamage,
    hpDamage,
    hitDamages,
    cadenceBonus,
    enemyHpAfter,
    enemyBlockAfter: simEnemyBlock,
    lethal,
    blockGain,
    playerBlockAfter,
    healGain,
    healTotal,
    playerHpAfter,
    strengthGain,
    weakGain,
    focusGain,
    drawGain,
    energyGain,
    nextIntent,
    nextIntentView,
    intentChanged,
    boosted,
    heroBadges,
  };
}

/**
 * 카드 표면에 보여 줄 전투 중 실시간 효과 조각을 만든다.
 * 힘·집중·유물 보정이 적용된 수치를 바로 보여 주어 암산을 줄인다.
 * @param {any} run
 * @param {{ uid?: string, type: keyof typeof CARDS, upgraded?: boolean }} card
 * @returns {CardEffectPart[]}
 */
export function liveCardEffects(run, card) {
  const c = cardDetails(card);
  const preview = run?.battle ? previewCardPlay(run, card) : null;
  /** @type {CardEffectPart[]} */
  const parts = [];

  if (c.damage) {
    const hits = c.hits ?? 1;
    if (preview && preview.hitDamages.length) {
      const sameHit = preview.hitDamages.every((v) => v === preview.hitDamages[0]);
      const text = sameHit
        ? `피해 ${preview.hitDamages[0]}${hits > 1 ? ` × ${hits}` : ''}`
        : `피해 ${preview.hitDamages.join('+')}`;
      parts.push({ text, boosted: preview.boosted.damage });
    } else {
      parts.push({ text: `피해 ${c.damage}${hits > 1 ? ` × ${hits}` : ''}`, boosted: false });
    }
  }
  if (c.block) {
    const val = preview ? preview.blockGain : c.block;
    parts.push({ text: `방어 ${val}`, boosted: Boolean(preview?.boosted.block) });
  }
  if (c.heal) {
    const val = preview ? preview.healTotal : c.heal;
    parts.push({ text: `HP ${val} 회복`, boosted: Boolean(preview?.boosted.heal) });
  }
  if (c.strength) {
    const val = preview ? preview.strengthGain : c.strength;
    parts.push({ text: `힘 +${val}`, boosted: Boolean(preview?.boosted.strength) });
  }
  if (c.weak) {
    const val = preview ? preview.weakGain : c.weak;
    parts.push({ text: `약화 ${val}턴`, boosted: Boolean(preview?.boosted.weak) });
  }
  if (c.focus) {
    parts.push({ text: `다음 카드 +${c.focus}`, boosted: false });
  }
  if (c.draw) {
    parts.push({ text: `${c.draw}장 뽑기`, boosted: false });
  }
  if (c.exhaust) {
    parts.push({ text: '소멸', boosted: false, muted: true });
  }
  return parts;
}

/**
 * 퀴즈 카드 상단 배너용 1줄 요약 텍스트.
 * @param {any} run
 * @param {{ uid?: string, type: keyof typeof CARDS, upgraded?: boolean } | null | undefined} card
 * @returns {string}
 */
export function summarizeCardEffect(run, card) {
  if (!card) return '';
  const parts = liveCardEffects(run, card).filter((p) => !p.muted);
  return parts.map((p) => p.text).join(' · ') || CARDS[card.type]?.kind || '';
}

/**
 * 카드 종류에 따른 시각적 역할군(색상 코드용).
 * @param {keyof typeof CARDS} type
 * @returns {'attack' | 'guard' | 'heal' | 'debuff' | 'buff'}
 */
export function cardRoleTone(type) {
  const kind = CARDS[type]?.kind;
  if (kind === '공격') return 'attack';
  if (kind === '방어') return 'guard';
  if (kind === '회복') return 'heal';
  if (kind === '약화') return 'debuff';
  return 'buff'; // 강화, 집중
}
