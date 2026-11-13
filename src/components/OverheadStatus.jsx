import GameIcon from './ui/GameIcon.jsx';
import { overheadIntent } from '../game/overhead.js';
import { useHeldStatuses } from './useHeldStatuses.js';
import './overhead.css';

// 장면 위치를 아직 재지 못했을 때 쓰는 자리. 2D 전투 화면의 용사(24%)·적(74%) 위치와 같다.
const FALLBACK = { hero: { left: 24, top: 46 }, enemy: { left: 74, top: 46 } };

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
