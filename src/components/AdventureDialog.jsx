import { useEffect, useRef, useState } from 'react';
import { TIERS } from '../vocabulary.js';
import { CARDS, MONSTERS, NODE_TYPES, RELICS, cardDetails, describeCard } from '../game/catalog.js';
import { intentFor, reachableNodes } from '../game/engine.js';
import { questionPool } from '../game/quiz.js';
import { TierCrest } from './VocabularyDialog.jsx';
import CombatScene from './CombatScene.jsx';
import QuizPanel from './QuizPanel.jsx';
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

export function Card({ card, onClick, disabled, actionLabel, initialFocus = false }) {
  const c = cardDetails(card);
  return <button className={`game-card rarity-${c.rarity}${card.upgraded ? ' is-upgraded' : ''}`} disabled={disabled}
    onClick={onClick} data-initial-focus={initialFocus ? '' : undefined}
    aria-label={`${c.name}${card.upgraded ? '+' : ''}, 에너지 ${c.cost}, ${describeCard(card)}${actionLabel ? `, ${actionLabel}` : ''}`}>
    <span className="card-top"><span className="card-cost" title="필요 에너지">{c.cost}</span><small>{c.rarity} · {c.kind}</small></span>
    <span className="card-icon" aria-hidden="true">{c.icon}</span>
    <strong>{c.name}{card.upgraded && '+'}</strong>
    <span className="card-description">{describeCard(card)}</span>
    <span className="card-action">{actionLabel || '단어로 발동'}</span>
  </button>;
}

function Relic({ relic, children }) {
  const r = RELICS[relic.id];
  return <div className="relic-item"><span className="relic-icon" aria-hidden="true">{r.icon}</span><div>
    <h4>{r.name} <small>Lv.{relic.level}</small></h4><p>{r.describe(relic.level)}</p>{children}
  </div></div>;
}

function DungeonMap({ run, onSelect, inspecting = false }) {
  const reachable = new Set(inspecting ? [] : reachableNodes(run).map((n) => n.id));
  return <section className="dungeon-map" aria-label="던전 경로">
    <div className="map-intro"><div><p className="game-eyebrow">DUNGEON ROUTE</p><h3>황혼의 석문</h3></div>
      <p>이어진 경로 중 한 곳을 선택하세요.<br /><span className="game-muted">휴식에서 회복하거나 강화하고, 마지막 석문의 보스에 도전하세요.</span></p></div>
    <div className="map-scroll"><div className="map-grid">
      <svg className="map-lines" viewBox="0 0 600 860" preserveAspectRatio="none" aria-hidden="true">
        {run.map.slice(0, -1).flatMap((row, f) => row.flatMap((node) => run.map[f + 1].filter((n) => Math.abs(n.lane - node.lane) <= 1).map((to) =>
          <line key={`${node.id}-${to.id}`} x1={100 + node.lane * 200} y1={50 + f * 108} x2={100 + to.lane * 200} y2={50 + (f + 1) * 108}
            className={run.visited.includes(node.id) && run.visited.includes(to.id) ? 'path-traveled' : ''} />)))}
      </svg>
      {run.map.map((row, f) => <div key={f} className="map-row" data-keyboard-group aria-label={`${f + 1}층`}>
        <span className="map-floor">{String(f + 1).padStart(2, '0')}</span>
        {row.map((node) => <button key={node.id} style={{ gridColumn: node.lane + 1 }} className={`map-node${reachable.has(node.id) ? ' is-reachable' : ''}${run.visited.includes(node.id) ? ' is-visited' : ''}`}
          disabled={!reachable.has(node.id)} onClick={() => onSelect(node.id)} data-initial-focus={reachable.has(node.id) ? '' : undefined}
          aria-label={`${f + 1}층 ${node.lane + 1}번 경로, ${NODE_TYPES[node.type].name}, ${NODE_TYPES[node.type].hint}`}>
          <span aria-hidden="true">{run.visited.includes(node.id) ? '✓' : NODE_TYPES[node.type].icon}</span>
          <strong>{NODE_TYPES[node.type].name}</strong><small>{NODE_TYPES[node.type].hint}</small>
        </button>)}
      </div>)}
    </div></div>
    <p className="game-help">금색 테두리: 선택 가능한 경로 · ✓: 지나온 노드 · 한 층에서 한 곳을 방문합니다.</p>
  </section>;
}

function Battle({ run, dispatch }) {
  const b = run.battle;
  const pending = b.pending;
  const feedback = b.feedback;
  const locked = !!(pending || feedback);
  const intent = intentFor(b.enemy);
  const selectedCard = pending && run.deck.find((c) => c.uid === pending.uid);
  const hand = b.hand.map((uid) => run.deck.find((c) => c.uid === uid));
  return <section className="battle-screen" aria-label="턴제 카드 전투">
    <div className="enemy-bar"><div><p className="game-eyebrow">{MONSTERS[b.enemy.type].art === 'boss' ? 'BOSS' : 'ENEMY'}</p><h3>{MONSTERS[b.enemy.type].name}</h3></div>
      <div className="enemy-health"><span>적 HP <strong>{b.enemy.hp} / {b.enemy.maxHp}</strong></span><meter min="0" max={b.enemy.maxHp} value={b.enemy.hp} aria-label="적 체력" /></div>
      <p className={`enemy-intent intent-${intent.kind}`} aria-live="polite"><small>다음 행동</small><strong>{intent.label}</strong></p></div>
    <div className="battle-status"><span>적 방어 {b.enemy.block} · 힘 +{b.enemy.strength}{b.enemy.weak > 0 && ` · 약화 ${b.enemy.weak}턴`}</span><span>턴 {b.turn}</span></div>
    <CombatScene enemy={b.enemy} effect={b.effect} />
    <div className="combat-nameplates"><span>모험가 <strong>HP {run.hp}/{run.maxHp}</strong></span><span>{MONSTERS[b.enemy.type].name}</span></div>
    <div className="player-status"><span>◇ 방어 <strong>{b.block}</strong></span><span>힘 <strong>+{b.strength}</strong></span><span>집중 <strong>+{b.focus}</strong></span><span>연속 정답 <strong>{b.streak}</strong></span></div>
    {pending || feedback ? <QuizPanel question={pending?.question ?? feedback.question} feedback={feedback}
      cardName={selectedCard ? CARDS[selectedCard.type].name : feedback.cardName}
      onAnswer={(answer) => dispatch({ type: 'ANSWER', id: pending.question.id, answer })}
      onContinue={() => dispatch({ type: 'ACK' })} /> : <p className="battle-message" aria-live="polite">{b.log[0]}</p>}
    <div className="hand-toolbar"><div className="energy-orb" aria-label={`에너지 ${b.energy}`}><span>{b.energy}</span><small>에너지 / 턴당 3</small></div>
      <p>뽑을 카드 {b.draw.length} · 버린 카드 {b.discard.length} · 소멸 {b.exhaust.length}<br /><small className="hand-intent">적 다음 행동: {intent.label}</small></p>
      <button className="game-primary end-turn" disabled={locked} onClick={() => dispatch({ type: 'END_TURN' })}>턴 종료 <span aria-hidden="true">▸</span></button></div>
    <div className="card-hand" data-keyboard-group aria-label="손에 든 카드">
      {hand.map((card) => <Card key={card.uid} card={card} disabled={locked || CARDS[card.type].cost > b.energy}
        onClick={() => dispatch({ type: 'SELECT_CARD', uid: card.uid })} initialFocus={!locked && CARDS[card.type].cost <= b.energy} />)}
      {!hand.length && <p className="game-muted">손에 든 카드가 없습니다. 턴을 종료해 새 카드를 뽑으세요.</p>}
    </div>
    <details className="combat-log"><summary>전투 기록 · 카드 사용 규칙</summary><p>선택 즉시 에너지와 카드를 소비합니다. 오답도 카드를 돌려주지 않습니다. 소멸 카드는 다음 전투에서 돌아옵니다. 집중은 다음에 성공한 카드의 수치에 적용되며, 집중 카드끼리는 누적됩니다.</p><ol>{b.log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol></details>
  </section>;
}

function Reward({ run, dispatch }) {
  const reward = run.reward;
  const existingRelic = run.relics.find((r) => r.id === reward.relic);
  return <section className="reward-screen"><p className="game-eyebrow">SPOILS OF THE DUNGEON</p><h3>{reward.cards.length ? '전투 승리' : '보물 발견'}</h3>
    <p>금화 <strong className="gold-text">+{reward.gold}</strong>를 받았습니다. 덱을 완성할 다음 선택을 하세요.</p>
    {reward.cards.length > 0 && <><h4>{reward.cardTaken ? '카드 선택 완료' : '카드 한 장을 선택하세요'}</h4>
      <div className="reward-cards" data-keyboard-group>{reward.cards.map((type) => <Card key={type} card={{ type }} disabled={reward.cardTaken}
        actionLabel="덱에 추가" onClick={() => dispatch({ type: 'TAKE_CARD', card: type })} initialFocus={!reward.cardTaken} />)}</div>
      {!reward.cardTaken && <button className="game-secondary" onClick={() => dispatch({ type: 'SKIP_CARD' })}>덱을 유지하고 카드 건너뛰기</button>}</>}
    {reward.relic && <div className="relic-reward"><Relic relic={{ id: reward.relic, level: existingRelic ? 2 : 1 }}>
      <button className="game-secondary" disabled={reward.relicTaken} onClick={() => dispatch({ type: 'TAKE_RELIC' })}>
        {reward.relicTaken ? '획득 완료' : existingRelic ? '유물 Lv.2로 강화' : '유물 획득'}</button>
    </Relic></div>}
    <button className="game-primary" disabled={!reward.cardTaken || !reward.relicTaken} data-initial-focus={reward.cardTaken && reward.relicTaken ? '' : undefined}
      onClick={() => dispatch({ type: 'LEAVE_REWARD' })}>다음 경로로 <span aria-hidden="true">▸</span></button>
  </section>;
}

function Services({ run, dispatch }) {
  const rest = run.phase === 'rest';
  const [tab, setTab] = useState('cards');
  return <section className="service-screen"><p className="game-eyebrow">{rest ? 'A MOMENT OF REST' : 'DUNGEON FORGE'}</p><h3>{rest ? '돌불 쉼터' : '불씨 대장간'}</h3>
    <p>{rest ? '회복과 카드 강화 중 하나를 선택하세요.' : '금화로 덱과 유물을 다듬으세요. 구입은 한 번, 강화는 금화가 허용하는 만큼 가능합니다.'}</p>
    {rest ? <button className="game-primary rest-action" data-initial-focus onClick={() => dispatch({ type: 'REST' })}>♨ HP 24 회복 <small>{run.hp} → {Math.min(run.maxHp, run.hp + 24)} / {run.maxHp}</small></button>
      : <div className="service-tabs" data-keyboard-group role="group" aria-label="대장간 분류">{[['cards', '카드 강화 · 30'], ['relics', '유물 강화 · 45'], ['shop', '카드 구입 · 35']].map(([id, label], i) =>
        <button key={id} className="game-secondary" aria-pressed={tab === id} data-initial-focus={i === 0 ? '' : undefined} onClick={() => setTab(id)}>{label}</button>)}</div>}
    {(rest || tab === 'cards') && <><h4>{rest ? '또는 카드 한 장 무료 강화' : '카드 강화'}</h4><div className="upgrade-list" data-keyboard-group>
      {run.deck.map((card) => <button key={card.uid} className="upgrade-item" disabled={card.upgraded || (!rest && run.gold < 30)}
        onClick={() => dispatch({ type: 'UPGRADE_CARD', uid: card.uid })}>
        <span><strong>{CARDS[card.type].name}{card.upgraded && '+'}</strong><small>{describeCard(card)}</small>
          {!card.upgraded && <small className="upgrade-preview">강화 후: {describeCard({ ...card, upgraded: true })}</small>}</span><span>{card.upgraded ? '강화 완료' : rest ? '무료 강화' : '30 금화'}</span>
      </button>)}
    </div></>}
    {!rest && tab === 'relics' && <div className="upgrade-list">{run.relics.map((relic) => <Relic key={relic.id} relic={relic}>
      {relic.level === 1 && <p className="upgrade-preview">강화 후: {RELICS[relic.id].describe(2)}</p>}
      <button className="game-secondary" disabled={relic.level === 2 || run.gold < 45} onClick={() => dispatch({ type: 'UPGRADE_RELIC', id: relic.id })}>{relic.level === 2 ? '최대 강화' : '45 금화 · Lv.2 강화'}</button>
    </Relic>)}</div>}
    {!rest && tab === 'shop' && <div className="reward-cards" data-keyboard-group>{run.service.stock.map((type) => <Card key={type} card={{ type }} actionLabel={run.service.bought ? '이번 방문 구입 완료' : '35 금화 · 구입'}
      disabled={run.service.bought || run.gold < 35} onClick={() => dispatch({ type: 'BUY_CARD', card: type })} />)}</div>}
    {!rest && <button className="game-primary" onClick={() => dispatch({ type: 'LEAVE_FORGE' })}>다음 경로로 <span aria-hidden="true">▸</span></button>}
  </section>;
}

function TierSelection({ progress, dispatch, onStarted }) {
  const [tier, setTier] = useState('bronze');
  const ongoing = progress.run && progress.run.phase !== 'result';
  const pool = questionPool(tier);
  return <section className="tier-selection"><p className="game-eyebrow">CHOOSE YOUR WORDS</p><h3>이번 모험의 학습 범위</h3>
    <p>티어는 선생님이 정한 누적 단어 범위예요. 모든 티어를 바로 선택할 수 있습니다.</p>
    <div className="adventure-tiers" role="group" aria-label="모험 티어" data-keyboard-group>
      {TIERS.map((t, i) => <button key={t.id} className={`tier-choice tier-${t.id}`} aria-pressed={t.id === tier} data-initial-focus={i === 0 ? '' : undefined} onClick={() => setTier(t.id)}>
        <TierCrest tier={t.id} /><span><strong>{t.label}</strong><small>{t.english}</small></span><span>{t.count.toLocaleString()}개</span>
      </button>)}
    </div>
    <div className="adventure-brief"><p><span>시작 덱</span><strong>12장 · 에너지 3 · HP 72</strong></p><p><span>던전</span><strong>8층 · 갈림길 · 보스 1체</strong></p><p><span>출제 범위</span><strong>검수 단어 {new Set(pool.map((q) => q.wordId)).size}개 · 문제 {pool.length}개</strong></p></div>
    <p className="game-help">단어장 전체는 그대로 열람할 수 있어요. 뜻·유의어·반의어 문제는 선택지까지 확인한 항목에서 출제하며, 부족하면 모든 문제를 소진한 뒤 다시 섞습니다. 전투 난도는 티어와 무관합니다.</p>
    {ongoing && <p className="game-notice">진행 중인 {tierLabel(progress.run.tier)} 모험이 있습니다. 아래 버튼을 누르면 임시 덱과 유물을 새로 시작합니다. 학습·오답·클리어 기록은 유지됩니다.</p>}
    <button className="game-primary" onClick={() => { dispatch({ type: 'START', tier, seed: seed() }); onStarted(); }}>{ongoing ? '기존 모험을 교체하고 시작' : '던전 입장'} <span aria-hidden="true">▸</span></button>
  </section>;
}

function Result({ run, progress, onClose }) {
  return <section className="run-result"><span className="result-sigil" aria-hidden="true">{run.result.won ? '♛' : '◇'}</span><p className="game-eyebrow">{run.result.won ? 'DUNGEON CLEARED' : 'ADVENTURE COMPLETE'}</p>
    <h3>{run.result.won ? '석문을 돌파했습니다' : '다음 도전을 준비하세요'}</h3>
    <p>{tierLabel(run.tier)} · {run.fights}회 전투 승리 · 정답 {run.correct}/{run.answers}</p>
    <p>이번 덱 {run.result.cards}장 · 유물 {run.result.relics}개</p>
    {run.result.unlocked && <div className="unlock-notice">✦ 전설 카드 ‘불멸의 서약’ 해금<br /><small>다음 모험부터 카드 보상과 상점에 등장합니다.</small></div>}
    <p>누적 학습 {progress.learning.attempts}문제 · 약점 {Object.values(progress.learning.entries).filter((e) => e.active).length}문제<br /><span className="game-muted">학습·오답·클리어 기록은 보존됩니다. 임시 카드와 유물은 다음 모험에 이월되지 않습니다.</span></p>
    <button className="game-primary" data-initial-focus onClick={onClose}>타이틀로 돌아가기</button>
  </section>;
}

export default function AdventureDialog({ progress, dispatch, error, newAdventure, onClose }) {
  const dialog = useRef(null);
  const [choosing, setChoosing] = useState(newAdventure);
  const [inspect, setInspect] = useState(null);
  const previousPhase = useRef(null);
  const run = progress.run;
  const phase = choosing ? 'tier' : run?.phase;
  const titles = { tier: '새 모험', map: '던전 경로', battle: '카드 전투', reward: '모험의 보상', rest: '휴식', forge: '강화와 구입', result: '도전 결과' };
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  const quizId = run?.battle?.pending?.question.id;
  const feedback = !!run?.battle?.feedback;
  useEffect(() => {
    const target = dialog.current.querySelector('[data-initial-focus]:not(:disabled)') ?? dialog.current.querySelector('.adventure-title');
    const enteringBattle = phase === 'battle' && previousPhase.current !== 'battle' && !inspect && !quizId && !feedback;
    target?.focus({ preventScroll: enteringBattle });
    if (enteringBattle) dialog.current.querySelector('.game-body').scrollTop = 0;
    previousPhase.current = phase;
  }, [phase, inspect, quizId, feedback]);

  return <dialog ref={dialog} className="game-dialog" aria-labelledby="adventure-title" onClose={onClose} onKeyDown={navigateGameButtons}>
    <header className="game-header"><div><p className="game-eyebrow">✦ S’WORD MASTER / {phase === 'tier' ? 'NEW ADVENTURE' : tierLabel(run?.tier)}</p>
      <h2 id="adventure-title" className="adventure-title" tabIndex={-1}>{inspect === 'deck' ? '나의 덱' : inspect === 'relics' ? '보유 유물' : inspect === 'map' ? '던전 경로' : titles[phase]}</h2></div>
      <button className="settings-close" aria-label="모험 닫고 타이틀로" onClick={() => dialog.current.close()}>×</button></header>
    {error && <p role="alert" className="game-save-error">{error}</p>}
    {!choosing && run && phase !== 'result' && <div className="run-toolbar"><div><TierCrest tier={run.tier} small /><span>{run.floor < 0 ? '입구' : `${run.floor + 1}층 / 8`}</span><span className="hp-text">HP {run.hp}/{run.maxHp}</span><span className="gold-text">◈ {run.gold}</span></div>
      <div className="run-inspect-buttons">{[['deck', `덱 ${run.deck.length}`], ['relics', `유물 ${run.relics.length}`], ['map', '경로']].map(([id, label]) => <button key={id} className="game-secondary" aria-pressed={inspect === id} onClick={() => setInspect(inspect === id ? null : id)}>{label}</button>)}</div></div>}
    <div className="game-body">
      {inspect ? <section className="inspection"><button className="game-secondary inspect-back" data-initial-focus onClick={() => setInspect(null)}>← 모험으로 돌아가기</button>
        {inspect === 'deck' ? <div className="deck-inspection">{run.deck.map((card) => <div className="deck-item" key={card.uid}><strong>{CARDS[card.type].name}{card.upgraded && '+'}</strong><span>에너지 {CARDS[card.type].cost} · {CARDS[card.type].rarity}</span><p>{describeCard(card)}</p></div>)}</div>
          : inspect === 'relics' ? run.relics.map((relic) => <Relic key={relic.id} relic={relic} />) : <DungeonMap run={run} inspecting />}
      </section> : choosing ? <TierSelection progress={progress} dispatch={dispatch} onStarted={() => setChoosing(false)} />
        : phase === 'map' ? <DungeonMap run={run} onSelect={(id) => dispatch({ type: 'SELECT_NODE', id })} />
          : phase === 'battle' ? <Battle run={run} dispatch={dispatch} />
            : phase === 'reward' ? <Reward run={run} dispatch={dispatch} />
              : ['rest', 'forge'].includes(phase) ? <Services key={`${phase}-${run.floor}`} run={run} dispatch={dispatch} />
                : phase === 'result' ? <Result run={run} progress={progress} onClose={() => dialog.current.close()} /> : <p>이어서 진행할 모험이 없습니다.</p>}
    </div>
    <footer className="game-footer"><span><kbd>방향키</kbd> 항목 이동 <kbd>Enter</kbd> 선택 <kbd>Esc</kbd> 타이틀</span><span>{error ? '저장 상태를 확인하세요' : '선택할 때마다 자동 저장'}</span></footer>
  </dialog>;
}
