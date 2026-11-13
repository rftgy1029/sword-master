import { useEffect, useMemo, useRef, useState } from 'react';
import { TIERS } from '../vocabulary.js';
import { CARDS, MONSTERS, NODE_TYPES, RELICS, cardDetails, describeCard } from '../game/catalog.js';
import { enemyAttackCue, enemyDamageImpacts, intentFor, reachableNodes, unlockedTierIds } from '../game/engine.js';
import { questionPool } from '../game/quiz.js';
import { schoolClearCount } from '../survey.js';
import { TierCrest } from './VocabularyDialog.jsx';
import CombatScene from './CombatScene.jsx';
import DungeonEntrance from './DungeonEntrance.jsx';
import QuizPanel from './QuizPanel.jsx';
import { TransitionVeil, useSceneTransition } from './SceneTransition.jsx';
import { useCardDeal } from './useCardDeal.js';
import { navigateTiers } from '../game/tierNavigation.js';
import { cardShortcutIndex, confirmShortcut, cancelShortcut } from '../game/combatShortcuts.js';
import StatusBadges from './StatusBadges.jsx';
import { CombatEnergy, CombatHealthBar, EnemyIntent } from './CombatIndicators.jsx';
import { heroImage } from '../game/spriteAssets.js';
import SceneView from './SceneView.jsx';
import GameIcon from './ui/GameIcon.jsx';
import './adventure.css';

const tierLabel = (id) => TIERS.find((t) => t.id === id)?.label;
const seed = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0];

export function navigateGameButtons(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.defaultPrevented) return;
  const group = event.target.closest('[data-keyboard-group]');
  if (!group || !event.target.matches('button')) return;
  const buttons = [...group.querySelectorAll('button:not(:disabled)')];
  const index = buttons.indexOf(event.target);
  const next = { ArrowDown: (index + 1) % buttons.length, ArrowRight: (index + 1) % buttons.length,
    ArrowUp: (index - 1 + buttons.length) % buttons.length, ArrowLeft: (index - 1 + buttons.length) % buttons.length,
    Home: 0, End: buttons.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  buttons[next]?.focus();
}

export function Card({ card, onClick, disabled, actionLabel, initialFocus = false, compact = false, hidden = false, shortcut }) {
  const c = cardDetails(card);
  return <button data-card-uid={card.uid} className={`game-card card-type-${card.type} rarity-${c.rarity}${card.upgraded ? ' is-upgraded' : ''}${hidden ? ' is-dealing' : ''}`} disabled={disabled}
    onClick={onClick} data-initial-focus={initialFocus ? '' : undefined}
    aria-label={`${shortcut ? `단축키 ${shortcut}, ` : ''}${c.name}${card.upgraded ? '+' : ''}, 에너지 ${c.cost}, ${describeCard(card)}${actionLabel ? `, ${actionLabel}` : ''}`}>
    <span className="card-top"><span className="card-cost" title="필요 에너지">{c.cost}</span>{shortcut && <span className="card-shortcut" aria-hidden="true">{shortcut}</span>}<small>{compact ? c.kind : `${c.rarity} · ${c.kind}`}</small></span>
    <span className="card-art" aria-hidden="true"><span/><GameIcon name={card.type}/><i/></span>
    <strong>{c.name}{card.upgraded && '+'}</strong>
    <span className="card-description">{describeCard(card)}</span>
    {!compact && <span className="card-action">{actionLabel || '단어로 발동'}</span>}
  </button>;
}

function Relic({ relic, children }) {
  const r = RELICS[relic.id];
  return <div className="relic-item"><span className="relic-icon" aria-hidden="true">{r.icon}</span><div>
    <h4>{r.name} <small>Lv.{relic.level}</small></h4><p>{r.describe(relic.level)}</p>{children}
  </div></div>;
}

function MapHero() {
  return <img className="map-hero-art" src={heroImage} alt="" aria-hidden="true" />;
}

function DungeonMap({ run, onSelect, inspecting = false, motionPreference = 'normal' }) {
  const routes = inspecting ? [] : reachableNodes(run);
  const reachable = new Set(routes.map((n) => n.id));
  const [destination, setDestination] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const timer = useRef(null);
  const selecting = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const player = destination ?? { lane: run.lane, floor: Math.max(0, run.floor) };
  const choose = (node) => {
    if (selecting.current || inspecting || !reachable.has(node.id)) return;
    selecting.current = true;
    setDestination(node);
    const still = motionPreference !== 'normal' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => onSelect(node.id), still ? 0 : 360);
  };
  const highlighted = run.map.flat().find((node) => node.id === highlight) ?? run.map.flat().find((node) => reachable.has(node.id));
  return <section className="dungeon-map living-map" aria-label="던전 경로">
    <div className="map-intro"><div><p className="game-eyebrow">살아 있는 던전</p><h3>황혼의 석문</h3></div>
      <p>{inspecting ? '지나온 길과 앞으로의 장소를 확인하세요.' : '빛나는 방을 누르거나 다음 경로를 선택하세요.'}</p></div>
    <div className="map-layout">
      <div className="map-overview"><SceneView mode="map" run={run} inspecting={inspecting || !!destination} highlightedNodeId={highlight} onHighlight={setHighlight}
        onSelect={(id)=>{const node=run.map.flat().find(item=>item.id===id);if(node)choose(node);}}/></div>
      <aside className="map-selection" aria-label="경로 선택">
        {!inspecting && <><h4>다음 경로 선택 <span>{Math.min(run.floor + 2, 8)}층 / 8</span></h4>
          <div className="map-route-options" data-keyboard-group style={{ '--route-count': Math.max(1, routes.length) }}>
            {routes.map((node, index) => <button key={node.id} data-node-id={node.id} className={`game-secondary map-node map-route-option is-reachable${destination?.id === node.id ? ' is-destination' : ''}`}
              onFocus={() => setHighlight(node.id)} onMouseEnter={() => setHighlight(node.id)} onMouseLeave={() => setHighlight(null)}
              disabled={!!destination} onClick={() => choose(node)} data-initial-focus={index === 0 ? '' : undefined}
              aria-label={`${node.floor + 1}층 ${node.lane + 1}번 경로, ${NODE_TYPES[node.type].name}, ${NODE_TYPES[node.type].hint}`}>
              <GameIcon name={{battle:'strike',elite:'oath',treasure:'spark',rest:'empower',forge:'heavy',boss:'oath'}[node.type]}/>
              <span><strong>{NODE_TYPES[node.type].name}</strong><small>{NODE_TYPES[node.type].hint}</small></span>
              <span className="map-route-arrow" aria-hidden="true">▸</span>
            </button>)}
          </div></>}
        <div className="map-place-summary" aria-live="polite"><strong>{highlighted ? NODE_TYPES[highlighted.type].name : '지나온 여정'}</strong><span>{highlighted ? NODE_TYPES[highlighted.type].hint : '용사가 지나온 길과 앞으로의 장소를 확인하세요.'}</span></div>
        <details className="map-details"><summary>전체 8층 경로 보기</summary>
    <div className="map-scroll"><div className="map-fog" aria-hidden="true" /><div className="map-grid">
      <svg className="map-lines" viewBox="0 0 600 1152" preserveAspectRatio="none" aria-hidden="true">
        {run.map.slice(0, -1).flatMap((row, f) => row.flatMap((node) => run.map[f + 1].filter((n) => Math.abs(n.lane - node.lane) <= 1).map((to) => {
          const traveled = run.visited.includes(node.id) && run.visited.includes(to.id);
          const available = reachable.has(to.id) && run.visited.includes(node.id);
          return <path key={node.id + to.id} d={`M ${100 + node.lane * 200} ${38 + f * 144} C ${100 + node.lane * 200} ${95 + f * 144}, ${100 + to.lane * 200} ${95 + f * 144}, ${100 + to.lane * 200} ${38 + (f + 1) * 144}`}
            className={traveled ? 'path-traveled' : available ? 'path-available' : ''} />;
        })))}
      </svg>
      <div className={`map-traveler${destination ? ' is-walking' : ''}`} style={{ left: `${(player.lane + .5) / 3 * 100}%`, top: player.floor * 144 + 93 }} aria-label="현재 용사 위치"><MapHero /><i /></div>
      {run.map.map((row, f) => <div key={f} className="map-row" data-keyboard-group aria-label={`${f + 1}층`} style={{ '--floor': f }}>
        <span className="map-floor">{String(f + 1).padStart(2, '0')}</span>
        {row.map((node) => <button key={node.id} style={{ gridColumn: node.lane + 1 }} className={`map-node place-${node.type}${reachable.has(node.id) ? ' is-reachable' : ''}${run.visited.includes(node.id) ? ' is-visited' : ''}${destination?.id === node.id ? ' is-destination' : ''}`}
          onFocus={() => setHighlight(node.id)} onMouseEnter={() => setHighlight(node.id)} disabled={!reachable.has(node.id) || !!destination} onClick={() => choose(node)}
          aria-label={`${f + 1}층 ${node.lane + 1}번 경로, ${NODE_TYPES[node.type].name}, ${NODE_TYPES[node.type].hint}`}>
          <span className="place-icon" aria-hidden="true"><GameIcon name={{battle:'strike',elite:'oath',treasure:'spark',rest:'empower',forge:'heavy',boss:'oath'}[node.type]}/></span>
          <strong>{NODE_TYPES[node.type].name}{run.visited.includes(node.id) && ' ✓'}</strong>
        </button>)}
      </div>)}
    </div></div></details>
      </aside>
    </div>
    <p className="game-help map-legend">빛나는 방: 이동 가능 · 금빛 길: 지나온 경로 · 한 층에서 한 곳을 선택합니다.</p>
  </section>;
}

function Battle({ run, wordbooks, dispatch, motionPreference, animateOpening, onOpeningDone }) {
  const section = useRef(null);
  const dealCanvas = useRef(null);
  const shortcut = useRef(null);
  useEffect(() => () => cancelShortcut(shortcut), []);
  const [skillBusy, setSkillBusy] = useState(false);
  const [visualStatus, setVisualStatus] = useState('loading');
  const loading = visualStatus === 'loading';
  const canAnimate = visualStatus === 'ready';
  const [fatalEffect, setFatalEffect] = useState(null);
  const attackCue = useRef(null);
  const fatalResolved = useRef(false);
  const fatal = !!fatalEffect;
  const [shownEnemyHP, setShownEnemyHP] = useState(run.battle.enemy.hp);
  const [shownPlayerHP, setShownPlayerHP] = useState(run.hp);
  const [shownIntent, setShownIntent] = useState(() => intentFor(run.battle.enemy));
  const transition = useSceneTransition();
  const b = run.battle;
  const pending = b.pending;
  const feedback = b.feedback;
  const locked = !!(pending || feedback);
  const intent = intentFor(b.enemy);
  const combatEffect = fatalEffect ?? b.effect;
  const cue = attackCue.current?.id === combatEffect.id ? attackCue.current.cue : undefined;
  const selectedCard = pending && run.deck.find((c) => c.uid === pending.uid);
  const hand = useMemo(() => b.hand.map((uid) => run.deck.find((c) => c.uid === uid)), [b.hand, run.deck]);
  const deal = useCardDeal({ section, canvas: dealCanvas, cards: hand, turn: b.turn, drawCount: b.draw.length,
    suspended: locked || skillBusy || loading, animateOpening,
    motionPreference: visualStatus === 'fallback' ? 'off' : motionPreference, onOpeningDone });
  const busy = loading || skillBusy || deal.busy || fatal;
  useEffect(() => { if (!skillBusy) setShownEnemyHP(b.enemy.hp); }, [skillBusy, b.enemy.hp]);
  useEffect(() => { if (!skillBusy) setShownPlayerHP(fatal ? 0 : run.hp); }, [skillBusy, run.hp, fatal]);
  useEffect(() => { if (!skillBusy) setShownIntent(intentFor(b.enemy)); }, [skillBusy, b.enemy]);
  useEffect(() => {
    const active = document.activeElement;
    if (!busy && (!active || ['BODY', 'DIALOG', 'H2'].includes(active.tagName) || active.disabled)) {
      section.current?.querySelector('[data-initial-focus]:not(:disabled)')?.focus({ preventScroll: true });
    }
  }, [busy, locked]);
  useEffect(() => {
    const onKeyDown = (event) => {
      const index = cardShortcutIndex(event);
      if (index === null || busy || locked || document.hidden) return;
      const target = event.target;
      const root = section.current;
      if (!root || !(root.contains(target) || target === root.closest('dialog') || target === document.body)) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const card = hand[index];
      if (!card || CARDS[card.type].cost > b.energy) return;
      event.preventDefault();
      const button = root.querySelectorAll('.card-hand .game-card')[index];
      confirmShortcut(shortcut, `card:${card.uid}`, button, () => dispatch({ type: 'SELECT_CARD', uid: card.uid }));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, locked, hand, b.energy, dispatch]);
  const endTurn = () => {
    if (busy) return;
    if (!canAnimate) { dispatch({ type: 'END_TURN' }); return; }
    const id = b.effect.id + 1;
    if (intent.kind === 'attack') {
      const impacts = enemyDamageImpacts(intent, b.block);
      const amount = impacts.reduce((total, hit) => total + hit, 0);
      attackCue.current = { id, cue: enemyAttackCue(b.enemy, intent) };
      if (amount >= run.hp) {
        setSkillBusy(true);
        setFatalEffect({ id, kind: 'hurt', amount, impacts });
        return;
      }
    }
    if (dispatch({ type: 'END_TURN' })) setSkillBusy(true);
  };
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.defaultPrevented ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || busy || locked || document.hidden) return;
      const target = event.target;
      const root = section.current;
      if (!root || !(root.contains(target) || target === root.closest('dialog') || target === document.body)) return;
      if (target instanceof Element) {
        if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
        const button = target.closest('button, summary, a');
        if (button && !button.matches('.card-hand .game-card, .end-turn')) return;
      }
      event.preventDefault();
      confirmShortcut(shortcut, 'end-turn', root.querySelector('.end-turn'), endTurn);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });
  return <>
    {loading && <div className="battle-loading" role="status">
      <span className="battle-loading-ring" aria-hidden="true" />
      <span>전투를 불러오는 중…</span>
    </div>}
    <section ref={section} className={`battle-screen${busy ? ' is-animating' : ''}`} aria-label="턴제 카드 전투" aria-busy={busy} inert={loading}>
      <div className="battle-stage">
      <div className="combat-hud">
        <section className="combatant-hud player-hud" aria-label="모험가 상태">
          <div className="combatant-heading"><h3>모험가</h3></div>
          <CombatHealthBar value={shownPlayerHP} max={run.maxHp} label="모험가 체력" motionPreference={motionPreference} />
        </section>
        <section className="combatant-hud enemy-hud" aria-label="적 상태">
          <div className="combatant-heading"><h3>{MONSTERS[b.enemy.type].name}</h3></div>
          <CombatHealthBar value={shownEnemyHP} max={b.enemy.maxHp} label="적 체력" motionPreference={motionPreference} />
        </section>
      </div>
    <div className="battlefield">
      <CombatScene enemy={b.enemy} effect={combatEffect} playerDead={fatal} cue={cue} motionPreference={motionPreference}
        playerIndicators={<StatusBadges battle={b} compact />}
        enemyIndicators={<><EnemyIntent intent={shownIntent} acting={skillBusy && ['hurt', 'enemy'].includes(combatEffect.kind)} /><StatusBadges battle={b} enemy compact /></>}
        onReady={() => setVisualStatus('ready')} onError={() => setVisualStatus('fallback')}
        onImpact={(_, target, hit) => {
          if (target === 'player') setShownPlayerHP((hp) => Math.max(fatal ? 0 : run.hp, hp - hit.amount));
          else setShownEnemyHP((hp) => Math.max(b.enemy.hp, hp - hit.amount));
        }}
        onBusy={(value, effectId) => {
          setSkillBusy(value);
          if (!value && fatalEffect?.id === effectId && !fatalResolved.current) {
            fatalResolved.current = true;
            transition(() => dispatch({ type: 'END_TURN' }));
          }
        }} />

      <span className="battle-turn">TURN <strong>{String(b.turn).padStart(2, '0')}</strong></span>
    </div>
    </div>
    <div className={`battle-controls${locked ? ' is-answering' : ''}`}>
      {!locked && <><div className="hand-toolbar"><CombatEnergy energy={b.energy} playable={hand.filter(card => CARDS[card.type].cost <= b.energy).length} />
        <p className="battle-message" aria-live="polite">{pending ? '단어 문제를 풀어 카드의 효과를 발동하세요.' : b.log[0]}</p>
        <button className="game-primary end-turn" disabled={locked || busy} data-initial-focus={!locked && !hand.some((card) => CARDS[card.type].cost <= b.energy) ? '' : undefined}
          onClick={endTurn}>턴 종료</button></div>
      <div className="pile-status"><div className="deck-pile draw-pile" aria-label={`뽑을 카드 ${b.draw.length}장`}><span>✦</span><small>뽑기 {b.draw.length}</small></div>
        <span className="draw-status" role="status">{deal.busy ? '덱에서 카드를 뽑고 있습니다…' : skillBusy ? combatEffect.kind === 'hurt' ? '몬스터가 공격하고 있습니다' : combatEffect.kind === 'enemy' ? '몬스터가 행동하고 있습니다' : '단어의 힘이 펼쳐집니다' : '숫자 키 2번으로 카드 선택 · Enter 2번으로 턴 종료'}</span>
        <div className="deck-pile discard-pile" aria-label={`버린 카드 ${b.discard.length}장`}><span>◇</span><small>버림 {b.discard.length} · 소멸 {b.exhaust.length}</small></div></div></>}
      {locked ? <QuizPanel compact busy={loading || skillBusy} question={pending?.question ?? feedback.question} feedback={feedback} wordbooks={wordbooks}
        cardName={selectedCard ? CARDS[selectedCard.type].name : feedback.cardName}
        onAnswer={(answer) => { if (!loading && dispatch({ type: 'ANSWER', id: pending.question.id, answer }) && canAnimate) setSkillBusy(true); }}
        onContinue={() => { if (loading || skillBusy) return; if (b.enemy.hp <= 0) transition(() => dispatch({ type: 'ACK' })); else dispatch({ type: 'ACK' }); }} /> : <div className="card-hand" data-keyboard-group aria-label="손에 든 카드">
        {hand.map((card, index) => <Card key={card.uid} card={card} compact shortcut={index < 4 ? index + 1 : undefined} hidden={deal.hidden.includes(card.uid)} disabled={busy || CARDS[card.type].cost > b.energy}
          onClick={() => { if (!busy) dispatch({ type: 'SELECT_CARD', uid: card.uid }); }} initialFocus={CARDS[card.type].cost <= b.energy} />)}
        {!hand.length && <p className="empty-hand game-muted">손에 든 카드가 없습니다. 턴을 종료해 새 카드를 뽑으세요.</p>}
      </div>}
    </div>
    <div ref={dealCanvas} className="card-deal-canvas" aria-hidden="true" />
    </section>
  </>;
}

function BattleLog({ battle }) {
  return <section className="combat-log" aria-label="전투 기록과 규칙">
    <h3>전투 기록 · 카드 사용 규칙</h3>
    <p>뽑을 카드 {battle.draw.length} · 버린 카드 {battle.discard.length} · 소멸 {battle.exhaust.length}</p>
    <p>선택 즉시 에너지와 카드를 소비합니다. 오답도 카드를 돌려주지 않습니다. 소멸 카드는 다음 전투에서 돌아옵니다. 집중은 다음에 성공한 카드의 수치에 적용되며, 집중 카드끼리는 누적됩니다.</p>
    <ol>{battle.log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol>
  </section>;
}

function Reward({ run, dispatch }) {
  const [picked, setPicked] = useState(null);
  const reward = run.reward;
  const existingRelic = run.relics.find((r) => r.id === reward.relic);
  return <section className="reward-screen"><p className="game-eyebrow">SPOILS OF THE DUNGEON</p><h3>{reward.cards.length ? '전투 승리' : '보물 발견'}</h3>
    <div className="location-scene"><SceneView mode="reward"/></div>
    <p>금화 <strong className="gold-text">+{reward.gold}</strong>를 받았습니다. 덱을 완성할 다음 선택을 하세요.</p>
    {reward.cards.length > 0 && <><h4>{reward.cardTaken ? '카드 선택 완료' : '카드 한 장을 선택하세요'}</h4>
      <div className="reward-cards" data-keyboard-group>{reward.cards.map((type) => <Card key={type} card={{ type }} disabled={reward.cardTaken}
        actionLabel="덱에 추가" onClick={() => { if (dispatch({ type: 'TAKE_CARD', card: type })) setPicked(type); }} initialFocus={!reward.cardTaken} />)}</div>
      {picked && <p className="loot-toast" role="status">{CARDS[picked].name} — 덱에 새겨졌습니다</p>}
      {!reward.cardTaken && <button className="game-secondary" onClick={() => dispatch({ type: 'SKIP_CARD' })}>덱을 유지하고 카드 건너뛰기</button>}</>}
    {reward.relic && <div className="relic-reward"><Relic relic={{ id: reward.relic, level: existingRelic ? 2 : 1 }}>
      <button className="game-secondary" disabled={reward.relicTaken} onClick={() => dispatch({ type: 'TAKE_RELIC' })}>
        {reward.relicTaken ? '획득 완료' : existingRelic ? '유물 Lv.2로 강화' : '유물 획득'}</button>
    </Relic></div>}
    {reward.relic && reward.relicTaken && <p className="loot-toast" role="status">✧ 유물의 힘이 용사에게 깃듭니다</p>}
    <button className="game-primary" disabled={!reward.cardTaken || !reward.relicTaken} data-initial-focus={reward.cardTaken && reward.relicTaken ? '' : undefined}
      onClick={() => dispatch({ type: 'LEAVE_REWARD' })}>다음 경로로 <span aria-hidden="true">▸</span></button>
  </section>;
}

function Services({ run, dispatch }) {
  const rest = run.phase === 'rest';
  const [tab, setTab] = useState('cards');
  const [spark, setSpark] = useState(null);
  const pending = useRef(null);
  useEffect(() => () => clearTimeout(pending.current), []);
  const perform = (action) => {
    if (pending.current) return;
    if (rest) {
      setSpark({ id: Date.now(), kind: action.type === 'REST' ? 'healing' : 'forging' });
      pending.current = setTimeout(() => { pending.current = null; dispatch(action); }, 300);
    } else if (dispatch(action)) setSpark({ id: Date.now(), kind: 'forging' });
  };
  return <section className="service-screen"><p className="game-eyebrow">{rest ? 'A MOMENT OF REST' : 'DUNGEON FORGE'}</p><h3>{rest ? '돌불 쉼터' : '불씨 대장간'}</h3>
    <div className="location-scene"><SceneView mode={rest?'rest':'forge'}/></div>
    <div className={`service-fire${rest ? ' campfire' : ''}`} aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--spark': i }} />)}<span>♨</span></div>
    {spark && <div key={spark.id} className={`service-burst ${spark.kind}`} role="status">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--spark': i }} />)}<span>{spark.kind === 'healing' ? '✚ 생명이 차오릅니다' : '✦ 새로운 힘이 새겨집니다'}</span></div>}
    <p>{rest ? '회복과 카드 강화 중 하나를 선택하세요.' : '금화로 덱과 유물을 다듬으세요. 구입은 한 번, 강화는 금화가 허용하는 만큼 가능합니다.'}</p>
    {rest ? <button className="game-primary rest-action" data-initial-focus onClick={() => perform({ type: 'REST' })}>♨ HP 24 회복 <small>{run.hp} → {Math.min(run.maxHp, run.hp + 24)} / {run.maxHp}</small></button>
      : <div className="service-tabs" data-keyboard-group role="group" aria-label="대장간 분류">{[['cards', '카드 강화 · 30'], ['relics', '유물 강화 · 45'], ['shop', '카드 구입 · 35']].map(([id, label], i) =>
        <button key={id} className="game-secondary" aria-pressed={tab === id} data-initial-focus={i === 0 ? '' : undefined} onClick={() => setTab(id)}>{label}</button>)}</div>}
    {(rest || tab === 'cards') && <><h4>{rest ? '또는 카드 한 장 무료 강화' : '카드 강화'}</h4><div className="upgrade-list" data-keyboard-group>
      {run.deck.map((card) => <button key={card.uid} className="upgrade-item" disabled={card.upgraded || (!rest && run.gold < 30)}
        onClick={() => perform({ type: 'UPGRADE_CARD', uid: card.uid })}>
        <span><strong>{CARDS[card.type].name}{card.upgraded && '+'}</strong><small>{describeCard(card)}</small>
          {!card.upgraded && <small className="upgrade-preview">강화 후: {describeCard({ ...card, upgraded: true })}</small>}</span><span>{card.upgraded ? '강화 완료' : rest ? '무료 강화' : '30 금화'}</span>
      </button>)}
    </div></>}
    {!rest && tab === 'relics' && <div className="upgrade-list">{run.relics.map((relic) => <Relic key={relic.id} relic={relic}>
      {relic.level === 1 && <p className="upgrade-preview">강화 후: {RELICS[relic.id].describe(2)}</p>}
      <button className="game-secondary" disabled={relic.level === 2 || run.gold < 45} onClick={() => perform({ type: 'UPGRADE_RELIC', id: relic.id })}>{relic.level === 2 ? '최대 강화' : '45 금화 · Lv.2 강화'}</button>
    </Relic>)}</div>}
    {!rest && tab === 'shop' && <div className="reward-cards" data-keyboard-group>{run.service.stock.map((type) => <Card key={type} card={{ type }} actionLabel={run.service.bought ? '이번 방문 구입 완료' : '35 금화 · 구입'}
      disabled={run.service.bought || run.gold < 35} onClick={() => perform({ type: 'BUY_CARD', card: type })} />)}</div>}
    {!rest && <button className="game-primary" onClick={() => perform({ type: 'LEAVE_FORGE' })}>다음 경로로 <span aria-hidden="true">▸</span></button>}
  </section>;
}

function TierSelection({ progress, dispatch, onStarted }) {
  const transition = useSceneTransition();
  const selection = useRef(null);
  const startButton = useRef(null);
  const [tier, setTier] = useState('bronze');
  const ongoing = progress.run && progress.run.phase !== 'result';
  const wordbooks = progress.wordbooks ?? [];
  const personal = wordbooks.some((book) => book.id === tier);
  const pool = questionPool(tier, wordbooks);
  const unlocked = unlockedTierIds(progress);
  const selectedTier = TIERS.find((t) => t.id === tier) ?? { label: wordbooks.find((book) => book.id === tier)?.name, count: pool.length };
  return <section ref={selection} className="tier-selection" onKeyDown={(event) => navigateTiers(event, {
    tiers: [...selection.current.querySelectorAll('[data-tier]:not(:disabled)')], start: startButton.current, select: setTier,
  })}>
    <div className="tier-selection-scroll"><div className="tier-selection-content">
      <div className="tier-selection-heading"><h3>학습 범위</h3>
        <div className="tier-heading-actions">
          {wordbooks.length > 0 && <select className="tier-book-select" aria-label="내 단어장 선택" value={personal ? tier : ''} onChange={(event) => setTier(event.target.value || 'bronze')}>
            <option value="">내 단어장</option>
            {wordbooks.map((book) => <option key={book.id} value={book.id}>{book.name} · {book.words.length}개</option>)}
          </select>}
          <details className="tier-guide"><summary aria-label="모험 정보와 출제 안내"><span className="tier-guide-title">모험 </span>안내</summary><div className="tier-guide-content">
            <div className="adventure-brief"><p><span>시작 덱</span><strong>12장 · 에너지 3 · HP 72</strong></p><p><span>던전</span><strong>8층 · 갈림길 · 보스 1체</strong></p><p><span>출제 범위</span><strong>단어 {new Set(pool.map((q) => q.wordId)).size}개 · 문제 {pool.length}개</strong></p></div>
            <p className="game-help">{personal ? '선택한 단어장에서 뜻 문제가 나옵니다. 클리어 기록은 내 단어장에 쌓입니다.' : '브론즈부터 보스를 쓰러뜨리면 다음 티어가 열립니다. 티어 범위의 모든 단어가 뜻 문제로 나오고, 일부 단어는 유의어·반의어 문제도 나옵니다. 전투 난도는 티어와 무관합니다.'}</p>
          </div></details>
        </div>
      </div>
      <p className="tier-selection-help">{personal ? '내 단어장이 선택되어 있어요. 아래 버튼으로 입장하세요.' : unlocked.length === 1 ? '브론즈가 선택되어 있어 바로 입장할 수 있어요.' : '티어는 누적 학습 범위예요. 범위를 고르고 입장하세요.'}</p>
      <div className="adventure-tiers" role="group" aria-label="모험 티어" data-keyboard-group>
        {TIERS.map((t, i) => <button key={t.id} data-tier={t.id} className={`tier-choice tier-${t.id}${!unlocked.includes(t.id) ? ' is-locked' : ''}`} disabled={!unlocked.includes(t.id)} aria-pressed={t.id === tier} data-initial-focus={i === 0 ? '' : undefined} onClick={() => setTier(t.id)}
          aria-label={`${t.label}, 누적 ${t.count.toLocaleString()}개 단어, ${!unlocked.includes(t.id) ? `${TIERS[i - 1].label} 클리어 후 해금` : t.id === tier ? '선택됨' : '선택 가능'}`}>
          <TierCrest tier={t.id} /><span><strong>{t.label}</strong><small>{t.english}</small></span><span className="tier-word-count">누적 {t.count.toLocaleString()}개</span>
          <small className="tier-condition"><span className="tier-condition-full">{!unlocked.includes(t.id) ? `🔒 ${TIERS[i - 1].label} 클리어 후 해금` : t.id === tier ? '✓ 선택됨' : progress.learning.clears[t.id] ? '클리어 · 선택 가능' : '선택 가능'}</span>
            <span className="tier-condition-compact" aria-hidden="true">{!unlocked.includes(t.id) ? '🔒' : t.id === tier ? '✓ 선택됨' : '선택 가능'}</span></small>
        </button>)}
      </div>
    </div></div>
    <div className="tier-entry-actions"><div className="tier-entry-content">
      {ongoing && <p id="tier-restart-notice" className="game-notice"><strong>{tierLabel(progress.run.tier) ?? wordbooks.find((book) => book.id === progress.run.tier)?.name} 모험 교체</strong><span>덱·유물 초기화 · 학습 기록 유지</span></p>}
      <div className="tier-entry-row">
        <div className="tier-entry-summary"><p className="game-eyebrow">선택한 범위로 입장</p><p aria-live="polite" aria-atomic="true"><strong>{selectedTier.label}</strong><span>{personal ? '단어' : '누적'} {selectedTier.count.toLocaleString()}개{!personal && ' 단어'}</span></p></div>
        <button ref={startButton} className="game-primary tier-start" aria-describedby={ongoing ? 'tier-restart-notice' : undefined} onClick={() => transition(() => { if (dispatch({ type: 'START', tier, seed: seed() })) onStarted(); })}>{ongoing ? '모험 교체 후 입장' : '던전 입장하기'} <span aria-hidden="true">▸</span></button>
      </div>
    </div></div>
  </section>;
}

function Result({ run, scopeLabel, progress, onClose }) {
  const nextTier = TIERS.find((tier) => tier.id === run.result.unlockedTier);
  return <section className="run-result"><span className="result-sigil" aria-hidden="true">{run.result.won ? '♛' : '◇'}</span><p className="game-eyebrow">{run.result.won ? '석문 돌파' : '모험의 끝'}</p>
    <div className="location-scene"><SceneView mode="result" won={run.result.won}/></div>
    <h3>{run.result.won ? '석문을 돌파했습니다' : '다음 도전을 준비하세요'}</h3>
    <p>{scopeLabel} · {run.fights}회 전투 승리 · 정답 {run.correct}/{run.answers}</p>
    <p>이번 덱 {run.result.cards}장 · 유물 {run.result.relics}개</p>
    {run.result.won && nextTier && <div className="unlock-notice tier-unlock">{nextTier.label} 던전의 문이 열렸습니다.<br /><small>다음 새 모험에서 선택할 수 있어요.</small></div>}
    {run.result.unlocked && <div className="unlock-notice">전설 카드 ‘불멸의 서약’ 해금<br /><small>다음 모험부터 카드 보상과 상점에 등장합니다.</small></div>}
    {run.result.won && TIERS.some(({ id }) => id === run.tier) && schoolClearCount(progress) === 1 &&
      <div className="unlock-notice survey-unlock">타이틀 메뉴에 ‘설문 참여’가 열렸습니다.<br /><small>직접 플레이해 본 느낌을 사용자 경험 조사로 들려주세요.</small></div>}
    <p>누적 학습 {progress.learning.attempts}문제 · 약점 {Object.values(progress.learning.entries).filter((e) => e.active).length}문제<br /><span className="game-muted">학습·오답·클리어 기록은 보존됩니다. 임시 카드와 유물은 다음 모험에 이월되지 않습니다.</span></p>
    <button className="game-primary" data-initial-focus onClick={onClose}>타이틀로 돌아가기</button>
  </section>;
}

export default function AdventureDialog({ progress, dispatch, error, newAdventure, onClose, motionPreference }) {
  const dialog = useRef(null);
  const transition = useSceneTransition();
  const requestClose = () => transition(() => dialog.current.close());
  const [animateBattle, setAnimateBattle] = useState(false);
  const battleMenu = useRef(null);
  const [choosing, setChoosing] = useState(newAdventure);
  const [entering, setEntering] = useState(false);
  const [inspect, setInspect] = useState(null);
  const previousPhase = useRef(null);
  const run = progress.run;
  const wordbooks = progress.wordbooks ?? [];
  const book = wordbooks.find(({ id }) => id === run?.tier);
  const scopeLabel = book?.name ?? tierLabel(run?.tier);
  const entranceScope = book ? { id: 'personal', label: book.name, count: book.words.length } : TIERS.find(({ id }) => id === run?.tier);
  const returnToTitle = () => transition(() => dialog.current.close(run?.tier === 'bronze' && run.result?.won ? 'bronze-clear' : ''));
  const phase = choosing ? 'tier' : entering ? 'entry' : run?.phase;
  const inCombat = phase === 'battle' && !inspect;
  const titles = { tier: '새 모험', entry: '던전 입장', map: '던전 경로', battle: '카드 전투', reward: '모험의 보상', rest: '휴식', forge: '강화와 구입', result: '도전 결과' };
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  const quizId = run?.battle?.pending?.question.id;
  const feedback = !!run?.battle?.feedback;
  useEffect(() => {
    const target = dialog.current.querySelector('[data-initial-focus]:not(:disabled):not([inert] *)') ?? dialog.current.querySelector('.adventure-title');
    const enteringBattle = phase === 'battle' && previousPhase.current !== 'battle' && !inspect && !quizId && !feedback;
    target?.focus({ preventScroll: enteringBattle || inCombat || ['entry', 'map'].includes(phase) });
    if (phase === 'entry' || (phase === 'map' && !inspect && run.floor < 0) || (inCombat && !quizId && !feedback)) dialog.current.querySelector('.game-body').scrollTop = 0;
    previousPhase.current = phase;
  }, [phase, inspect, quizId, feedback, inCombat]);

  return <dialog ref={dialog} className={`game-dialog${inCombat ? ' is-battle' : ''}${phase === 'entry' ? ' is-entering' : ''}`} aria-labelledby="adventure-title" onClose={(event) => onClose(event.currentTarget.returnValue)} onKeyDown={navigateGameButtons}
    onPointerDown={(event) => { if (battleMenu.current?.open && !battleMenu.current.contains(event.target)) battleMenu.current.open = false; }}
    onCancel={(event) => { if (battleMenu.current?.open) { event.preventDefault(); battleMenu.current.open = false; battleMenu.current.querySelector('summary').focus(); } else { event.preventDefault(); requestClose(); } }}>
    <header className="game-header"><div><p className="game-eyebrow">{phase === 'tier' ? '새 모험' : scopeLabel}</p>
      <h2 id="adventure-title" className="adventure-title" tabIndex={-1}>{inspect === 'deck' ? '나의 덱' : inspect === 'relics' ? '보유 유물' : inspect === 'map' ? '던전 경로' : inspect === 'log' ? '전투 기록' : inCombat ? `${run.floor + 1}층 · 카드 전투` : titles[phase]}</h2></div>
      <div className="game-header-actions">{inCombat && <>
        <span className="battle-save-status" title={error || '선택할 때마다 자동 저장'}>{error ? '저장 확인' : '자동 저장'}</span>
        <details className="battle-menu" ref={battleMenu}>
          <summary aria-label="전투 메뉴">메뉴 <span aria-hidden="true">☰</span></summary>
          <div className="battle-menu-content"><p className="gold-text">◈ 금화 {run.gold}</p>
            <div data-keyboard-group>{[['deck', `나의 덱 · ${run.deck.length}장`], ['relics', `보유 유물 · ${run.relics.length}개`], ['map', '던전 경로'], ['log', '전투 기록 · 규칙']].map(([id, label]) =>
              <button key={id} onClick={() => { battleMenu.current.open = false; transition(() => { setAnimateBattle(false); setInspect(id); }); }}>{label}</button>)}</div>
            <p>뽑을 카드 {run.battle.draw.length} · 버린 카드 {run.battle.discard.length} · 소멸 {run.battle.exhaust.length}</p>
          </div>
        </details></>}
        <button className="settings-close" aria-label="모험 닫고 타이틀로" onClick={requestClose}>×</button>
      </div></header>
    {error && <p role="alert" className="game-save-error">{error}</p>}
    {!choosing && run && !['result', 'entry'].includes(phase) && !inCombat && <div className="run-toolbar"><div><TierCrest tier={book ? 'personal' : run.tier} small /><span>{run.floor < 0 ? '입구' : `${run.floor + 1}층 / 8`}</span><span className="hp-text">HP {run.hp}/{run.maxHp}</span><span className="gold-text">◈ {run.gold}</span></div>
      <div className="run-inspect-buttons">{[['deck', `덱 ${run.deck.length}`], ['relics', `유물 ${run.relics.length}`], ['map', '경로']].map(([id, label]) => <button key={id} className="game-secondary" aria-pressed={inspect === id} onClick={() => transition(() => { setAnimateBattle(false); setInspect(inspect === id ? null : id); })}>{label}</button>)}</div></div>}
    <div className="game-body">
      {inspect ? <section className="inspection"><button className="game-secondary inspect-back" data-initial-focus onClick={() => transition(() => setInspect(null))}>← 모험으로 돌아가기</button>
        {inspect === 'deck' ? <div className="deck-inspection">{run.deck.map((card) => <div className="deck-item" key={card.uid}><strong>{CARDS[card.type].name}{card.upgraded && '+'}</strong><span>에너지 {CARDS[card.type].cost} · {CARDS[card.type].rarity}</span><p>{describeCard(card)}</p></div>)}</div>
          : inspect === 'relics' ? run.relics.map((relic) => <Relic key={relic.id} relic={relic} />) : inspect === 'log' ? <BattleLog battle={run.battle} /> : <DungeonMap run={run} inspecting motionPreference={motionPreference} />}
      </section> : choosing ? <TierSelection progress={progress} dispatch={dispatch} onStarted={() => { setChoosing(false); setEntering(true); }} />
        : phase === 'entry' ? <DungeonEntrance tier={entranceScope} motionPreference={motionPreference} onComplete={() => transition(() => setEntering(false))} />
        : phase === 'map' ? <DungeonMap key={run.floor} run={run} motionPreference={motionPreference} onSelect={(id) => transition(() => { if (dispatch({ type: 'SELECT_NODE', id })) setAnimateBattle(true); })} />
          : phase === 'battle' ? <Battle key={run.floor} run={run} wordbooks={wordbooks} dispatch={dispatch} motionPreference={motionPreference} animateOpening={animateBattle} onOpeningDone={() => setAnimateBattle(false)} />
            : phase === 'reward' ? <Reward run={run} dispatch={(action) => action.type === 'LEAVE_REWARD' ? transition(() => dispatch(action)) : dispatch(action)} />
              : ['rest', 'forge'].includes(phase) ? <Services key={`${phase}-${run.floor}`} run={run} dispatch={(action) => action.type === 'LEAVE_FORGE' || phase === 'rest' ? transition(() => dispatch(action)) : dispatch(action)} />
                : phase === 'result' ? <Result run={run} scopeLabel={scopeLabel} progress={progress} onClose={returnToTitle} /> : <p>이어서 진행할 모험이 없습니다.</p>}
    </div>
    {!inCombat && !['tier', 'entry', 'map'].includes(phase) && <footer className="game-footer"><span><kbd>방향키</kbd> 항목 이동 <kbd>Enter</kbd> 선택 <kbd>Esc</kbd> 타이틀</span><span>{error ? '저장 상태를 확인하세요' : '선택할 때마다 자동 저장'}</span></footer>}
    <TransitionVeil />
  </dialog>;
}
