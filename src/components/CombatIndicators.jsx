import { useEffect, useRef, useState } from 'react';
import GameIcon from './ui/GameIcon.jsx';
import FloatingTooltip, { useTooltipTrigger } from './ui/FloatingTooltip.jsx';
import { describeEnemyIntent } from '../game/enemyIntent.js';

export function CombatHealthBar({
  value,
  max,
  label,
  motionPreference = 'normal',
  previewValue = null,
  previewKind = null,
  previewLabel = '',
  block = 0,
  previewBlockGain = 0,
}) {
  const [trail, setTrail] = useState(value);
  const previous = useRef(value);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const damaged = value < previous.current;
    previous.current = value;
    if (!damaged || motionPreference !== 'normal' || systemReduced) {
      setTrail(value);
      return;
    }
    const timer = setTimeout(() => setTrail(value), 450);
    return () => clearTimeout(timer);
  }, [value, motionPreference, systemReduced]);

  const clampPct = (hp) => Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100));
  const percent = (hp) => `${clampPct(hp)}%`;
  const hasDamagePreview = previewValue !== null && (previewKind === 'damage' || previewKind === 'lethal') && previewValue < value;
  const hasHealPreview = previewValue !== null && previewKind === 'heal' && previewValue > value;
  const currentBarHp = hasDamagePreview ? previewValue : value;
  const totalBlock = block + previewBlockGain;

  return <div className={`combat-health-wrap${totalBlock > 0 ? ' has-block' : ''}${previewKind === 'lethal' ? ' is-lethal-preview' : ''}`}>
    {totalBlock > 0 && <span className={`health-shield-chip${previewBlockGain > 0 ? ' is-preview' : ''}`}
      title={previewBlockGain > 0 ? `현재 방어 ${block} + 예상 ${previewBlockGain}` : `현재 방어 ${block}`}>
      <GameIcon name="guard" />
      <strong>{previewBlockGain > 0 && block > 0 ? `${block}→${totalBlock}` : previewBlockGain > 0 ? `+${previewBlockGain}` : block}</strong>
    </span>}
    <div className={`combat-health-bar${hasDamagePreview || hasHealPreview ? ' has-preview' : ''}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="health-damage-trail" style={{ width: percent(trail) }} aria-hidden="true" />
      <span className="health-current" style={{ width: percent(currentBarHp) }} aria-hidden="true" />
      {hasDamagePreview && <span className={`health-preview-band is-${previewKind}`}
        style={{ left: percent(previewValue), width: `${clampPct(value) - clampPct(previewValue)}%` }} aria-hidden="true" />}
      {hasHealPreview && <span className="health-preview-band is-heal"
        style={{ left: percent(value), width: `${clampPct(previewValue) - clampPct(value)}%` }} aria-hidden="true" />}
      <span className="health-value" aria-hidden="true">{value}/{max}</span>
      {previewLabel && <span className={`health-preview-tag is-${previewKind}`} aria-hidden="true">{previewLabel}</span>}
    </div>
  </div>;
}

export function CombatEnergy({ energy, maxEnergy = 3, playable, previewCost = 0, previewAfter = null }) {
  const hasPreview = previewAfter !== null && (previewCost > 0 || previewAfter !== energy);
  return <div className={`combat-energy${energy === 0 ? ' is-empty' : ''}${hasPreview ? ' has-preview' : ''}`}
    aria-label={`에너지 ${energy}, 이번 턴 낼 수 있는 카드 ${playable}장`}>
    <div className="sts-energy-orb" title={`에너지 ${energy} / ${maxEnergy} (매 턴 ${maxEnergy} 회복)`}>
      <span className="sts-energy-ring" aria-hidden="true" />
      <span className="sts-energy-core" aria-hidden="true" />
      <span className="sts-energy-readout">
        <strong className="sts-energy-current">{energy}</strong>
        <small className="sts-energy-max">/{maxEnergy}</small>
      </span>
      {hasPreview && <em className="sts-energy-preview" aria-hidden="true">→{previewAfter}</em>}
    </div>
    <div className="energy-meta">
      <div className="energy-gems" aria-hidden="true">
        {Array.from({ length: Math.max(maxEnergy, energy) }, (_, index) => {
          const filled = index < energy;
          const willSpend = hasPreview && filled && index >= previewAfter;
          return <span key={index} className={`energy-gem${filled ? ' is-filled' : ''}${willSpend ? ' is-spending' : ''}`} />;
        })}
      </div>
      <span className="energy-label">에너지{playable > 0 ? ` · ${playable}장` : ' · 종료'}</span>
    </div>
  </div>;
}

export function EnemyIntent({ intent, acting = false, playerBlock = 0, playerHp = 0, locked = false, preview = null }) {
  const interactive = !acting && !locked;
  const { open, setOpen, host, id, hostProps, buttonProps } = useTooltipTrigger(interactive);
  const showingPreview = Boolean(preview && preview.intentChanged && !acting && !locked);

  let view;
  if (showingPreview && preview.lethal) {
    view = {
      kind: 'wait',
      icon: 'strike',
      timing: '카드 예상',
      stance: '처치',
      tone: 'opportunity',
      title: '적 처치 가능!',
      summary: '피해 0 · 전투 승리',
      ariaLabel: '카드 예상: 적 처치 가능, 피해 0',
      tooltip: {
        title: '이 카드로 적을 처치할 수 있어요',
        verdict: '정답을 맞히면 적의 HP가 0이 되어 이번 공격을 받지 않고 승리합니다.',
        tip: '카드를 선택하고 단어의 뜻을 맞혀 마무리하세요.',
      },
    };
  } else if (showingPreview && preview.nextIntentView) {
    view = {
      ...preview.nextIntentView,
      timing: '카드 예상',
      ariaLabel: `카드 예상: ${preview.nextIntentView.title}, ${preview.nextIntentView.stance}, ${preview.nextIntentView.summary}`,
    };
  } else {
    view = describeEnemyIntent(intent, { playerBlock, playerHp, acting });
  }

  if (!view) return null;
  const { tooltip } = view;

  return <span {...hostProps} className="overhead-intent-host">
    <button type="button" className={`overhead-intent intent-${view.kind} tone-${view.tone}${showingPreview ? ' is-preview' : ''}`} aria-label={view.ariaLabel} {...buttonProps}>
      <GameIcon name={view.icon} />
      <span className="intent-body">
        <span className="intent-head">
          <small>{view.timing}</small>
          <em className={`intent-stance tone-${view.tone}`}>{view.stance}</em>
          {!showingPreview && <i className="intent-help-dot" aria-hidden="true">?</i>}
        </span>
        <strong>{view.title}</strong>
        <span className={`intent-summary tone-${view.tone}`}>{view.summary}</span>
      </span>
    </button>
    {open && <FloatingTooltip anchor={host} id={id} className={`intent-tooltip tone-${view.tone}`} onDismiss={() => setOpen(false)}>
      <span className="intent-tooltip-head">
        <strong>{tooltip.title}</strong>
        <em className={`intent-stance tone-${view.tone}`}>{view.stance}</em>
      </span>
      <span className="intent-tooltip-verdict">{tooltip.verdict}</span>
      <small>{tooltip.tip}</small>
    </FloatingTooltip>}
  </span>;
}
