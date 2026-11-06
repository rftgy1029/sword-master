import { useEffect, useId, useRef, useState } from 'react';
import { statusSheet } from '../game/spriteAssets.js';

function Badge({ icon, name, value, duration, description, harmful = false }) {
  const index = { '방어': 0, '힘': 1, '집중': 2, '약화': 3, '연속 정답': 4 }[name] ?? 7;
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
    <button type="button" aria-expanded={open} aria-describedby={open ? id : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}
      onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
      <span className="status-pixel-icon" aria-hidden="true" style={{ backgroundImage: `url(${statusSheet})`, backgroundPosition: `${-index * 24}px 0` }}>{icon}</span><strong>{name} {value}</strong><small>{duration}</small>
    </button>
    {open && <span className="status-tooltip" id={id} role="tooltip"><strong>{name} {value}</strong><span>{description}</span><small>지속: {duration}</small></span>}
  </span>;
}

export default function StatusBadges({ battle, enemy = false }) {
  const state = enemy ? battle.enemy : battle;
  return <div className="status-badges" aria-label={enemy ? '적의 지속 효과' : '용사의 지속 효과'}>
    {state.block > 0 && <Badge icon="◇" name="방어" value={state.block} duration={enemy ? '다음 적 행동까지' : '다음 내 턴까지'} description="받는 공격 피해를 이 수치만큼 먼저 막습니다. 공격을 막으면 남은 방어가 줄어듭니다." />}
    {state.strength > 0 && <Badge icon="⚔" name="힘" value={`+${state.strength}`} duration="전투 동안" description="공격의 매 타격 피해가 증가합니다. 전투가 끝나면 사라집니다." />}
    {!enemy && state.focus > 0 && <Badge icon="◎" name="집중" value={`+${state.focus}`} duration="다음 성공 카드" description="다음 정답 카드의 피해·방어·회복 등의 수치를 높입니다. 집중 카드는 집중을 더 쌓습니다." />}
    {enemy && state.weak > 0 && <Badge icon="↓" name="약화" value={`${state.weak}턴`} duration="적 행동 후 1턴 감소" harmful description="적의 공격 피해가 25% 감소합니다. 적이 행동한 뒤 남은 턴이 줄어듭니다." />}
    {!enemy && state.streak > 0 && <Badge icon="✦" name="연속 정답" value={state.streak} duration="오답 전까지" description="이번 전투의 연속 정답 수입니다. 삼박의 종 유물이 있으면 3연속 정답마다 추가 피해를 줍니다." />}
    {!(state.block || state.strength || (enemy ? state.weak : state.focus || state.streak)) && <small className="no-status">지속 효과 없음</small>}
  </div>;
}
