import { useEffect, useRef, useState } from 'react';
import GameIcon from './ui/GameIcon.jsx';
import FloatingTooltip, { useTooltipTrigger } from './ui/FloatingTooltip.jsx';
import { describeEnemyIntent } from '../game/enemyIntent.js';

export function CombatHealthBar({ value, max, label, motionPreference = 'normal' }) {
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
  const percent = hp => `${Math.max(0, Math.min(100, hp / max * 100))}%`;
  return <div className="combat-health-bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
    <span className="health-damage-trail" style={{ width: percent(trail) }} aria-hidden="true" />
    <span className="health-current" style={{ width: percent(value) }} aria-hidden="true" />
    <span className="health-value" aria-hidden="true">HP {value} / {max}</span>
  </div>;
}

export function CombatEnergy({ energy, playable }) {
  return <div className="combat-energy" aria-label={`에너지 ${energy}, 이번 턴 낼 수 있는 카드 ${playable}장`}>
    <div className="energy-reserve"><div className="energy-gems" aria-hidden="true">
      {[0, 1, 2].map(index => <span key={index} className={`energy-gem${index < energy ? ' is-filled' : ''}`} />)}
      {energy > 3 && <span className="energy-extra">+{energy - 3}</span>}
    </div><span>에너지 <strong>{energy}</strong></span></div>
    <span className="playable-card-count" aria-live="polite" title="현재 에너지로 선택할 수 있는 손패 수예요. 카드를 사용하면 다시 계산됩니다.">이번 턴 낼 수 있는 카드 <strong>{playable}장</strong></span>
  </div>;
}

export function EnemyIntent({ intent, acting = false, playerBlock = 0, playerHp = 0, locked = false }) {
  const interactive = !acting && !locked;
  const { open, setOpen, host, id, hostProps, buttonProps } = useTooltipTrigger(interactive);
  const view = describeEnemyIntent(intent, { playerBlock, playerHp, acting });

  if (!view) return null;
  const { tooltip } = view;

  return <span {...hostProps} className="overhead-intent-host">
    <button type="button" className={`overhead-intent intent-${view.kind} tone-${view.tone}`} aria-label={view.ariaLabel} {...buttonProps}>
      <GameIcon name={view.icon} />
      <span className="intent-body">
        <span className="intent-head">
          <small>{view.timing}</small>
          <em className={`intent-stance tone-${view.tone}`}>{view.stance}</em>
          <i className="intent-help-dot" aria-hidden="true">?</i>
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
