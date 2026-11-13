import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GameIcon from './ui/GameIcon.jsx';
import { useHeldStatuses } from './useHeldStatuses.js';

function StatusTooltip({ anchor, id, name, value, description, duration }) {
  const tooltip = useRef(null);
  const dialog = anchor.current?.closest('dialog');
  useLayoutEffect(() => {
    if (!dialog) return;
    const position = () => {
      if (!anchor.current || !tooltip.current) return;
      const box = dialog.getBoundingClientRect(), button = anchor.current.getBoundingClientRect(), popup = tooltip.current;
      const left = Math.max(10, Math.min(dialog.clientWidth - popup.offsetWidth - 10, button.left - box.left));
      const below = button.bottom - box.top + 8;
      const top = below + popup.offsetHeight < dialog.clientHeight - 10 ? below : Math.max(10, button.top - box.top - popup.offsetHeight - 8);
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    position();
    window.addEventListener('resize', position);
    dialog.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); dialog.removeEventListener('scroll', position, true); };
  }, [anchor, dialog]);
  if (!dialog) return null;
  return createPortal(<span ref={tooltip} className="status-tooltip is-floating" id={id} role="tooltip"><strong>{name} {value}</strong><span>{description}</span><small>지속: {duration}</small></span>, dialog);
}

function Badge({ name, value, duration, description, harmful = false, compact = false, gain = 0, gainToken = 0 }) {
  const symbol = { '방어': 'guard', '힘': 'strike', '집중': 'focus', '약화': 'weaken', '연속 정답': 'spark' }[name] ?? 'spark';
  const [open, setOpen] = useState(false);
  const host = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event) => { if (!host.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <span ref={host} className={`status-badge ${harmful ? 'is-harmful' : 'is-helpful'}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" aria-label={`${name} ${value}, ${duration}`} aria-expanded={open} aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
      <span className="status-symbol" aria-hidden="true"><GameIcon name={symbol}/></span><strong>{!compact && `${name} `}{value}</strong>{!compact && <small>{duration}</small>}
    </button>
    {compact && gain > 0 && <em key={gainToken} className="status-gain" aria-hidden="true">+{gain}</em>}
    {open && (compact ? <StatusTooltip anchor={host} id={id} name={name} value={value} description={description} duration={duration} /> : <span className="status-tooltip" id={id} role="tooltip"><strong>{name} {value}</strong><span>{description}</span><small>지속: {duration}</small></span>)}
  </span>;
}

export default function StatusBadges({ battle, enemy = false, compact = false, busy = false }) {
  const held = useHeldStatuses(battle, enemy ? 'enemy' : 'hero', compact && busy, true);
  const state = compact ? Object.fromEntries(held.list.map(({ id, value }) => [id, value])) : enemy ? battle.enemy : battle;
  return <div className={`status-badges${compact ? ' is-compact' : ''}`} aria-label={enemy ? '적의 지속 효과' : '용사의 지속 효과'}>
    {state.block > 0 && <Badge compact={compact} gain={held.gains.block} gainToken={held.token} name="방어" value={state.block} duration={enemy ? '다음 적 행동까지' : '다음 내 턴까지'} description="받는 공격 피해를 이 수치만큼 먼저 막습니다. 공격을 막으면 남은 방어가 줄어듭니다." />}
    {state.strength > 0 && <Badge compact={compact} gain={held.gains.strength} gainToken={held.token} name="힘" value={`+${state.strength}`} duration="전투 동안" description="공격의 매 타격 피해가 증가합니다. 전투가 끝나면 사라집니다." />}
    {!enemy && state.focus > 0 && <Badge compact={compact} gain={held.gains.focus} gainToken={held.token} name="집중" value={`+${state.focus}`} duration="다음 성공 카드" description="다음 정답 카드의 피해·방어·회복 등의 수치를 높입니다. 집중 카드는 집중을 더 쌓습니다." />}
    {enemy && state.weak > 0 && <Badge compact={compact} gain={held.gains.weak} gainToken={held.token} name="약화" value={`${state.weak}턴`} duration="적 행동 후 1턴 감소" harmful description="적의 공격 피해가 25% 감소합니다. 적이 행동한 뒤 남은 턴이 줄어듭니다." />}
    {!enemy && state.streak > 0 && <Badge compact={compact} gain={held.gains.streak} gainToken={held.token} name="연속 정답" value={state.streak} duration="오답 전까지" description="이번 전투의 연속 정답 수입니다. 삼박의 종 유물이 있으면 3연속 정답마다 추가 피해를 줍니다." />}
    {!compact && !(state.block || state.strength || (enemy ? state.weak : state.focus || state.streak)) && <small className="no-status">지속 효과 없음</small>}
  </div>;
}
