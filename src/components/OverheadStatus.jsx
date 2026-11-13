import { useEffect, useRef, useState } from 'react';
import GameIcon from './ui/GameIcon.jsx';
import { overheadIntent, overheadStatuses, statusGains } from '../game/overhead.js';
import './overhead.css';

// 장면 위치를 아직 재지 못했을 때 쓰는 자리. 2D 전투 화면의 용사(24%)·적(74%) 위치와 같다.
const FALLBACK = { hero: { left: 24, top: 46 }, enemy: { left: 74, top: 46 } };

// 연출이 진행되는 동안에는 이전 상태를 유지하고, 연출이 끝난 뒤 새 상태와 증가량을 보여 준다.
// 표시 체력·적 의도와 같은 시점(skillBusy 해제)에 맞춰 바뀐다.
function useHeldStatuses(battle, side, busy) {
  const next = overheadStatuses(battle, side);
  const key = next.map(({ id, value }) => `${id}:${value}`).join('|');
  const latest = useRef(next);
  latest.current = next;
  const [shown, setShown] = useState(() => ({ key, list: next, gains: {}, token: 0 }));
  useEffect(() => {
    if (busy) return;
    setShown((previous) => previous.key === key ? previous
      : { key, list: latest.current, gains: statusGains(previous.list, latest.current), token: previous.token + 1 });
  }, [busy, key]);
  useEffect(() => {
    if (!Object.keys(shown.gains).length) return undefined;
    const timer = setTimeout(() => setShown((previous) => previous.token === shown.token ? { ...previous, gains: {} } : previous), 1600);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}

function StatusRow({ items, gains }) {
  if (!items.length) return null;
  return <div className="overhead-statuses">
    {items.map((item) => <span key={item.id} data-status={item.id}
      className={`overhead-status tone-${item.tone}${gains[item.id] ? ' is-gained' : ''}`}>
      <GameIcon name={item.icon} /><span className="overhead-status-label">{item.label}</span><b>{item.text}</b>
      {gains[item.id] ? <em className="overhead-gain">+{gains[item.id]}</em> : null}
    </span>)}
  </div>;
}

const place = (anchor) => ({ left: `${anchor.left}%`, top: `${anchor.top}%` });

// enemyDown·playerDown은 타격에 맞춰 줄어드는 표시 체력 기준이다. 결과를 타격보다 먼저 드러내지 않는다.
export default function OverheadStatus({ battle, intent, busy = false, answering = false, anchors, enemyDown = false, playerDown = false }) {
  const hero = useHeldStatuses(battle, 'hero', busy);
  const enemy = useHeldStatuses(battle, 'enemy', busy);
  const next = overheadIntent(intent);
  return <div className={`overhead-layer${busy ? ' is-busy' : ''}${answering ? ' is-answering' : ''}`}
    data-anchored={anchors ? 'scene' : 'fallback'} aria-hidden="true">
    {!playerDown && hero.list.length > 0 && <div className="overhead overhead-hero" data-overhead="hero" style={place(anchors?.hero ?? FALLBACK.hero)}>
      <StatusRow items={hero.list} gains={hero.gains} />
    </div>}
    {!enemyDown && <div className="overhead overhead-enemy" data-overhead="enemy" style={place(anchors?.enemy ?? FALLBACK.enemy)}>
      {next && <div key={`${next.kind}-${next.value}`} className={`overhead-intent tone-${next.tone}`} data-intent={next.kind}>
        <small>다음 행동</small>
        <span className="overhead-intent-main"><GameIcon name={next.icon} /><strong>{next.label}</strong>{next.value && <b>{next.value}</b>}</span>
        {next.detail && <em>{next.detail}</em>}
      </div>}
      <StatusRow items={enemy.list} gains={enemy.gains} />
    </div>}
  </div>;
}
