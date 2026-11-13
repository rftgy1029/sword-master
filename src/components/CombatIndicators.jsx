import { useEffect, useRef, useState } from 'react';
import GameIcon from './ui/GameIcon.jsx';

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

export function EnemyIntent({ intent, acting }) {
  const icon = { attack: 'strike', block: 'guard', buff: 'empower', charge: 'heavy', wait: 'flow' }[intent.kind];
  const label = { attack: `공격 ${intent.value}${intent.hits ? ` × ${intent.hits}` : ''}`, block: `방어 +${intent.value}`, buff: `힘 +${intent.value}`, charge: `강타 준비 ${intent.value}`, wait: '숨 고르기' }[intent.kind];
  return <div className={`overhead-intent intent-${intent.kind}`} role="status" aria-label={`${acting ? '진행 중' : '다음 행동'}: ${intent.label}`} title={intent.label}>
    <GameIcon name={icon} /><span><small>{acting ? '진행 중' : '다음 행동'}</small><strong>{label}</strong></span>
  </div>;
}
