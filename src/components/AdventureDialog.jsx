import { useEffect, useMemo, useRef, useState } from 'react';
import { TIERS } from '../vocabulary.js';
import { CARDS, MONSTERS, NODE_TYPES, RELICS, cardDetails, describeCard } from '../game/catalog.js';
import { enemyAttackCue, enemyDamageImpacts, intentFor, reachableNodes, unlockedTierIds } from '../game/engine.js';
import { questionById, questionPool } from '../game/quiz.js';
import { cardRoleTone, liveCardEffects, previewCardPlay, summarizeCardEffect } from '../game/cardPreview.js';
import { schoolClearCount } from '../survey.js';
import { TierCrest } from './VocabularyDialog.jsx';
import CombatScene from './CombatScene.jsx';
import DungeonEntrance from './DungeonEntrance.jsx';
import BattleQuizDock from './BattleQuizDock.jsx';
import { TransitionVeil, useSceneTransition } from './SceneTransition.jsx';
import { useCardDeal } from './useCardDeal.js';
import { navigateTiers } from '../game/tierNavigation.js';
import { cardShortcutIndex, confirmShortcut, cancelShortcut } from '../game/combatShortcuts.js';
import StatusBadges from './StatusBadges.jsx';
import { CombatEnergy, CombatHealthBar, EnemyIntent } from './CombatIndicators.jsx';
import SceneView from './SceneView.jsx';
import { useGraphics } from './GraphicsContext.jsx';
import { preloadCombatAssets } from '../game/assetPreload.js';
import GameIcon from './ui/GameIcon.jsx';
import FloatingTooltip, { useTooltipTrigger } from './ui/FloatingTooltip.jsx';
import RouteMap, { ROUTE_STATUS_TEXT, RouteLegend } from './RouteMap.jsx';
import { ROUTE_LOOK, routeMapState } from '../game/routeMap.js';
import { ADMIN_MODE, useAdmin } from '../admin/entry.js';
import './adventure.css';

const tierLabel = (id) => TIERS.find((t) => t.id === id)?.label;
const seed = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0];

export function navigateGameButtons(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.defaultPrevented) return;
  const group = event.target.closest('[data-keyboard-group]');
  if (!group) return;
  const buttons = [...group.querySelectorAll('button:not(:disabled)')];
  if (!buttons.length) return;
  if (event.target === group) {
    const first = { ArrowDown: 0, ArrowRight: 0, Home: 0, ArrowUp: buttons.length - 1, ArrowLeft: buttons.length - 1, End: buttons.length - 1 }[event.key];
    if (first === undefined) return;
    event.preventDefault();
    buttons[first]?.focus();
    return;
  }
  if (!event.target.matches('button')) return;
  const index = buttons.indexOf(event.target);
  const next = { ArrowDown: (index + 1) % buttons.length, ArrowRight: (index + 1) % buttons.length,
    ArrowUp: (index - 1 + buttons.length) % buttons.length, ArrowLeft: (index - 1 + buttons.length) % buttons.length,
    Home: 0, End: buttons.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  buttons[next]?.focus();
}

export function Card({
  card,
  onClick,
  disabled,
  actionLabel,
  initialFocus = false,
  compact = false,
  hidden = false,
  shortcut,
  liveEffects = null,
  onPreviewStart,
  onPreviewEnd,
  style,
}) {
  const c = cardDetails(card);
  const role = cardRoleTone(card.type);
  const plainDesc = describeCard(card);
  const spokenDesc = liveEffects ? liveEffects.map((part) => part.text).join(', ') : plainDesc;
  return <button data-card-uid={card.uid} style={style}
    className={`game-card card-type-${card.type} role-${role} rarity-${c.rarity}${card.upgraded ? ' is-upgraded' : ''}${hidden ? ' is-dealing' : ''}`}
    disabled={disabled}
    onClick={onClick}
    onMouseEnter={onPreviewStart}
    onMouseMove={onPreviewStart}
    onMouseLeave={onPreviewEnd}
    onFocus={onPreviewStart}
    onBlur={onPreviewEnd}
    data-initial-focus={initialFocus ? '' : undefined}
    aria-label={`${shortcut ? `단축키 ${shortcut}, ` : ''}${c.name}${card.upgraded ? '+' : ''}, 에너지 ${c.cost}, ${spokenDesc}${actionLabel ? `, ${actionLabel}` : ''}`}>
    <span className="card-cost" title="필요 에너지">{c.cost}</span>
    {shortcut && <span className="card-shortcut" aria-hidden="true">{shortcut}</span>}
    <span className="card-banner"><strong>{c.name}{card.upgraded && '+'}</strong></span>
    <span className="card-frame" aria-hidden="true">
      <span className="card-art"><span/><GameIcon name={card.type}/><i/></span>
      <span className="card-kind-pill">{compact ? c.kind : `${c.rarity} · ${c.kind}`}</span>
    </span>
    <span className="card-description">
      {liveEffects ? liveEffects.map((part, i) => (
        <span key={`${part.text}-${i}`} className={`card-effect-part${part.boosted ? ' is-boosted' : ''}${part.muted ? ' is-muted' : ''}`}>
          {i > 0 && <i aria-hidden="true"> · </i>}{part.text}
        </span>
      )) : plainDesc}
    </span>
    {!compact && <span className="card-action">{actionLabel || '단어로 발동'}</span>}
  </button>;
}

function BattleRelicChip({ relic, onInspect }) {
  const r = RELICS[relic.id];
  const { open, setOpen, host, id, hostProps, buttonProps } = useTooltipTrigger(true);
  return <span {...hostProps} className="battle-relic-host">
    <button type="button" className={`battle-relic-chip${relic.level > 1 ? ' is-upgraded' : ''}`}
      aria-label={`${r.name} Lv.${relic.level}, ${r.describe(relic.level)}`}
      {...buttonProps}
      onClick={() => onInspect?.('relics')}>
      <span className="battle-relic-glyph" aria-hidden="true">{r.icon}</span>
      {relic.level > 1 && <em className="battle-relic-lv" aria-hidden="true">{relic.level}</em>}
    </button>
    {open && <FloatingTooltip anchor={host} id={id} onDismiss={() => setOpen(false)}>
      <strong>{r.name} Lv.{relic.level}</strong>
      <span>{r.describe(relic.level)}</span>
    </FloatingTooltip>}
  </span>;
}

function Relic({ relic, children }) {
  const r = RELICS[relic.id];
  return <div className="relic-item"><span className="relic-icon" aria-hidden="true">{r.icon}</span><div>
    <h4>{r.name} <small>Lv.{relic.level}</small></h4><p>{r.describe(relic.level)}</p>{children}
  </div></div>;
}

function DungeonMap({ run, onSelect, inspecting = false, motionPreference = 'normal' }) {
  const section = useRef(null);
  const routes = inspecting ? [] : reachableNodes(run);
  const reachable = new Set(routes.map((n) => n.id));
  const map = useMemo(() => routeMapState(run, { inspecting }), [run, inspecting]);
  const [destination, setDestination] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const timer = useRef(null);
  const selecting = useRef(false);
  const shortcut = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); cancelShortcut(shortcut); }, []);
  const choose = (node) => {
    if (selecting.current || inspecting || !reachable.has(node.id)) return;
    selecting.current = true;
    setDestination(node);
    const still = motionPreference !== 'normal' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => onSelect(node.id), still ? 0 : 420);
  };
  // 전투 카드와 같은 방식: 숫자 키를 한 번 누르면 그 길을 고르고, 같은 키를 한 번 더 누르면 이동한다.
  useEffect(() => {
    if (inspecting) return undefined;
    const onKeyDown = (event) => {
      const index = cardShortcutIndex(event);
      const root = section.current;
      if (index === null || selecting.current || document.hidden || !root) return;
      const target = event.target;
      if (!(root.contains(target) || target === root.closest('dialog') || target === document.body)) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const node = routes[index];
      const button = root.querySelectorAll('.map-route-options .map-route-option')[index];
      if (!node || !button) return;
      event.preventDefault();
      confirmShortcut(shortcut, `route:${node.id}`, button, () => choose(node));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });
  // 갈 수 있는 곳은 오른쪽 버튼이 이미 보여 주므로, 아래 안내 칸은 그 밖의 장소를 살펴볼 때만 바뀐다.
  const shown = map.nodes.find((node) => node.id === highlight && node.status !== 'reachable');
  const floorLabel = (floor) => floor < 0 ? '입구' : `${floor + 1}층`;
  return <section ref={section} className="dungeon-map living-map" aria-label="던전 경로">
    <div className="map-layout">
      <div className="map-overview"><RouteMap map={map} routes={routes} highlight={highlight} destination={destination}
        onHighlight={setHighlight} onChoose={choose} /></div>
      <aside className="map-selection" aria-label="경로 선택">
        <div className="map-selection-head"><h4>{inspecting ? '지나온 길' : '어디로 갈까요?'}</h4>
          <span className="map-floor-chip">{inspecting ? `${floorLabel(run.floor)} / 8층` : `${floorLabel(run.floor + 1)} / 8층`}</span></div>
        {!inspecting && <div className="map-route-options" data-keyboard-group style={{ '--route-count': Math.max(1, routes.length) }}>
          {routes.map((node, index) => <button key={node.id} data-node-id={node.id}
            className={`map-node map-route-option tone-${ROUTE_LOOK[node.type].tone}${highlight === node.id ? ' is-highlighted' : ''}${destination?.id === node.id ? ' is-destination' : ''}`}
            onFocus={() => setHighlight(node.id)} onMouseEnter={() => setHighlight(node.id)} onMouseLeave={() => setHighlight(null)}
            disabled={!!destination} onClick={() => choose(node)} data-initial-focus={index === 0 ? '' : undefined}
            aria-label={`${node.floor + 1}층 ${node.lane + 1}번 경로, ${NODE_TYPES[node.type].name}, ${NODE_TYPES[node.type].hint}, 숫자 키 ${index + 1}`}>
            <span className="route-option-tile" data-order={index + 1}><GameIcon name={ROUTE_LOOK[node.type].icon}/></span>
            <span className="route-option-text"><strong>{NODE_TYPES[node.type].name}</strong><small>{NODE_TYPES[node.type].hint}</small></span>
            <span className="route-option-word" aria-hidden="true">{ROUTE_LOOK[node.type].word}</span>
          </button>)}
        </div>}
        <p className="map-place-summary" aria-live="polite">
          {shown ? <><b>{floorLabel(shown.floor)} {NODE_TYPES[shown.type].name}</b> · {ROUTE_STATUS_TEXT[shown.status]}<br/><span>{NODE_TYPES[shown.type].hint}</span></>
            : inspecting ? <><b>▸</b> 금빛 길이 지금까지 지나온 길이에요.</>
              : <><b>▸</b> 주황색 칸만 갈 수 있어요. 숫자 키를 두 번 눌러도 돼요.</>}
        </p>
        <RouteLegend />
      </aside>
    </div>
  </section>;
}

function Battle({ run, wordbooks, dispatch, motionPreference, shortcutConfirm = 'single', animateOpening, onOpeningDone, onInspect, onHeroHpChange }) {
  const admin = useAdmin();
  const infiniteEnergy = ADMIN_MODE && admin.cheats.infiniteEnergy;
  const skipQuiz = ADMIN_MODE && admin.cheats.skipQuiz;
  const invincible = ADMIN_MODE && admin.cheats.invincible;
  const showAnswerHint = ADMIN_MODE && admin.cheats.showAnswer;
  const section = useRef(null);
  const dealCanvas = useRef(null);
  const shortcut = useRef(null);
  const toastTimer = useRef(null);
  const wrongRevealTimer = useRef(null);
  const handledFeedbackKey = useRef(null);
  const autoAckedKey = useRef(null);
  const lastQuizCard = useRef(null);
  useEffect(() => () => {
    cancelShortcut(shortcut);
    clearTimeout(toastTimer.current);
    clearTimeout(wrongRevealTimer.current);
  }, []);
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
  const [shownBlock, setShownBlock] = useState(run.battle.block);
  const [shownIntent, setShownIntent] = useState(() => intentFor(run.battle.enemy));
  const [shownEnergy, setShownEnergy] = useState(run.battle.energy);
  const [hoveredCardUid, setHoveredCardUid] = useState(null);
  const [focusedCardUid, setFocusedCardUid] = useState(null);
  const [answerToast, setAnswerToast] = useState(null);
  const [wrongTimerDoneKey, setWrongTimerDoneKey] = useState(null);
  const transition = useSceneTransition();
  const b = run.battle;
  const graphics = useGraphics();
  useEffect(() => {
    if (graphics.renderer !== '2d' && !graphics.unavailable) preloadCombatAssets({ priorityType: b.enemy.type });
  }, [b.enemy.type, graphics.renderer, graphics.unavailable]);
  const pending = b.pending;
  const feedback = b.feedback;
  const inQuiz = Boolean(pending || feedback);
  const locked = inQuiz;
  const intent = intentFor(b.enemy);
  const combatEffect = fatalEffect ?? b.effect;
  const enemyActing = skillBusy && ['hurt', 'enemy'].includes(combatEffect.kind);
  const cue = attackCue.current?.id === combatEffect.id ? attackCue.current.cue : undefined;
  const selectedCard = pending && run.deck.find((c) => c.uid === pending.uid);
  if (selectedCard) {
    lastQuizCard.current = { card: selectedCard, summary: summarizeCardEffect(run, selectedCard) };
  }
  const fallbackCardType = !selectedCard && feedback
    ? Object.entries(CARDS).find(([, def]) => def.name === feedback.cardName)?.[0]
    : null;
  const quizCard = selectedCard ?? lastQuizCard.current?.card ?? (fallbackCardType ? { type: fallbackCardType, upgraded: false } : null);
  const quizCardSummary = selectedCard
    ? summarizeCardEffect(run, selectedCard)
    : lastQuizCard.current?.summary ?? '';
  const hand = useMemo(() => b.hand.map((uid) => run.deck.find((c) => c.uid === uid)), [b.hand, run.deck]);
  const playableCount = useMemo(() => hand.filter((card) => infiniteEnergy || CARDS[card.type].cost <= b.energy).length, [hand, b.energy, infiniteEnergy]);
  const deal = useCardDeal({ section, canvas: dealCanvas, cards: hand, turn: b.turn, drawCount: b.draw.length,
    suspended: locked || skillBusy || loading, animateOpening,
    motionPreference: visualStatus === 'fallback' ? 'off' : motionPreference, onOpeningDone });
  const busy = loading || skillBusy || (!inQuiz && deal.busy) || fatal;

  useEffect(() => {
    if (locked || busy) {
      setHoveredCardUid(null);
      setFocusedCardUid(null);
    }
  }, [locked, busy]);

  const previewUid = hoveredCardUid ?? focusedCardUid;
  const previewCard = useMemo(() => {
    if (locked || busy || !previewUid) return null;
    const card = hand.find((item) => item.uid === previewUid);
    if (!card || (!infiniteEnergy && CARDS[card.type].cost > b.energy)) return null;
    return card;
  }, [locked, busy, previewUid, hand, b.energy, infiniteEnergy]);

  const cardPreview = useMemo(() => (
    previewCard ? previewCardPlay(run, previewCard, {
      enemyHp: shownEnemyHP,
      playerHp: shownPlayerHP,
      playerBlock: shownBlock,
    }) : null
  ), [run, previewCard, shownEnemyHP, shownPlayerHP, shownBlock]);

  useEffect(() => { if (!skillBusy) setShownEnemyHP(b.enemy.hp); }, [skillBusy, b.enemy.hp]);
  useEffect(() => { if (!skillBusy) setShownPlayerHP(fatal ? 0 : run.hp); }, [skillBusy, run.hp, fatal]);
  useEffect(() => { onHeroHpChange?.(shownPlayerHP); }, [shownPlayerHP, onHeroHpChange]);
  useEffect(() => { if (!skillBusy) setShownBlock(b.block); }, [skillBusy, b.block]);
  useEffect(() => { if (!skillBusy) setShownIntent(intentFor(b.enemy)); }, [skillBusy, b.enemy]);
  useEffect(() => { if (!enemyActing) setShownEnergy(b.energy); }, [enemyActing, b.energy]);

  const showToast = (toast, durationMs = 1900) => {
    const id = Date.now() + Math.random();
    setAnswerToast({ ...toast, id });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setAnswerToast((current) => (current?.id === id ? null : current));
    }, durationMs);
  };

  const feedbackKey = feedback ? `${b.effect.id}:${feedback.question.id}` : null;
  const reducedMotion = motionPreference === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrongRevealMs = reducedMotion ? 700 : 1150;

  // 정답·오답 모두 전장 상단 슬림 토스트로 단어와 뜻을 한 번 더 각인한다.
  useEffect(() => {
    if (!feedback || !feedbackKey) return;
    if (handledFeedbackKey.current === feedbackKey) return;
    handledFeedbackKey.current = feedbackKey;
    const source = questionById(feedback.question.id, wordbooks);
    if (!source) return;
    if (feedback.correct) {
      showToast({
        tone: 'correct',
        badge: feedback.cardName,
        term: source.word.term,
        meaning: source.word.meaning,
      }, 1850);
    } else {
      showToast({
        tone: 'wrong',
        badge: '오답 복기',
        term: source.word.term,
        meaning: source.word.meaning,
      }, 2600);
    }
  }, [feedback, feedbackKey, wordbooks]);

  // 오답 시 1.15초 정답 하이라이트 후 자동 복귀(클릭/Enter/Space로 즉시 스킵 가능).
  useEffect(() => {
    clearTimeout(wrongRevealTimer.current);
    if (!feedback || feedback.correct || loading || !feedbackKey) return undefined;
    wrongRevealTimer.current = setTimeout(() => {
      setWrongTimerDoneKey(feedbackKey);
    }, wrongRevealMs);
    return () => clearTimeout(wrongRevealTimer.current);
  }, [feedback, feedbackKey, loading, wrongRevealMs]);

  const skipWrongReveal = () => {
    if (!feedback || feedback.correct || loading || !feedbackKey) return;
    clearTimeout(wrongRevealTimer.current);
    setWrongTimerDoneKey(feedbackKey);
  };

  // 연출(정답) 또는 1.15초 하이라이트(오답)가 끝나면 손패 또는 승리로 자동 복귀한다.
  useEffect(() => {
    if (!feedback || !feedbackKey || loading || skillBusy) return undefined;
    if (autoAckedKey.current === feedbackKey) return undefined;
    if (feedback.correct) {
      const delay = canAnimate ? (reducedMotion ? 90 : 180) : (reducedMotion ? 150 : 280);
      const timer = setTimeout(() => {
        autoAckedKey.current = feedbackKey;
        if (b.enemy.hp <= 0) transition(() => dispatch({ type: 'ACK' }));
        else dispatch({ type: 'ACK' });
      }, delay);
      return () => clearTimeout(timer);
    }
    if (wrongTimerDoneKey === feedbackKey) {
      autoAckedKey.current = feedbackKey;
      dispatch({ type: 'ACK' });
    }
    return undefined;
  }, [feedback, feedbackKey, loading, skillBusy, wrongTimerDoneKey, b.enemy.hp, canAnimate, reducedMotion, dispatch, transition]);

  const pendingQuestionId = pending?.question?.id;
  useEffect(() => {
    if (busy || feedback) return;
    const active = document.activeElement;
    if (!active || ['BODY', 'DIALOG', 'H2'].includes(active.tagName) || active.disabled || active.closest('[inert]')) {
      section.current?.querySelector('[data-initial-focus]:not(:disabled):not([inert] *)')?.focus({ preventScroll: true });
    }
  }, [busy, locked, pendingQuestionId, feedback]);

  const playCard = (uid) => {
    if (busy || locked) return;
    if (skipQuiz) {
      if (dispatch({ type: 'ADMIN_SKIP_PLAY_CARD', uid }) && canAnimate) setSkillBusy(true);
      return;
    }
    dispatch({ type: 'SELECT_CARD', uid });
  };

  const handleAnswer = (answer) => {
    if (loading || fatal || !pending) return;
    if (dispatch({ type: 'ANSWER', id: pending.question.id, answer }) && canAnimate) setSkillBusy(true);
  };

  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;
  useEffect(() => {
    if (!ADMIN_MODE) return undefined;
    return admin.registerBattleActions({
      answer: (choice) => handleAnswerRef.current(choice),
    });
  }, [admin]);

  useEffect(() => {
    if (!ADMIN_MODE || feedback || pending || loading || skillBusy || b.enemy.hp > 0) return undefined;
    const delay = canAnimate ? (reducedMotion ? 90 : 180) : (reducedMotion ? 150 : 280);
    const timer = setTimeout(() => {
      transition(() => dispatch({ type: 'ADMIN_FINISH_VICTORY' }));
    }, delay);
    return () => clearTimeout(timer);
  }, [feedback, pending, loading, skillBusy, b.enemy.hp, canAnimate, reducedMotion, dispatch, transition]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const index = cardShortcutIndex(event, 5);
      if (index === null || busy || locked || document.hidden) return;
      const target = event.target;
      const root = section.current;
      if (!root || !(root.contains(target) || target === root.closest('dialog') || target === document.body)) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const card = hand[index];
      if (!card || (!infiniteEnergy && CARDS[card.type].cost > b.energy)) return;
      event.preventDefault();
      const button = root.querySelectorAll('.card-hand .game-card')[index];
      confirmShortcut(shortcut, `card:${card.uid}`, button, () => playCard(card.uid), { mode: shortcutConfirm });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, locked, hand, b.energy, dispatch, shortcutConfirm, infiniteEnergy, skipQuiz, canAnimate]);

  const endTurn = () => {
    if (busy || locked) return;
    if (!canAnimate) { dispatch({ type: 'END_TURN' }); return; }
    const id = b.effect.id + 1;
    if (intent.kind === 'attack') {
      const impacts = invincible
        ? enemyDamageImpacts(intent, intent.value * (intent.hits ?? 1) + 999)
        : enemyDamageImpacts(intent, b.block);
      const amount = impacts.reduce((total, hit) => total + hit, 0);
      attackCue.current = { id, cue: enemyAttackCue(b.enemy, intent) };
      if (!invincible && amount >= run.hp) {
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
      const endButton = root.querySelector('.end-turn');
      // 낼 수 있는 카드가 없거나 이미 턴 종료에 포커스가 있을 때만 1회 Enter로 바로 종료해 실수를 막는다.
      const endTurnMode = shortcutConfirm === 'single' && (playableCount === 0 || document.activeElement === endButton)
        ? 'single'
        : 'double';
      confirmShortcut(shortcut, 'end-turn', endButton, endTurn, { mode: endTurnMode });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  const enemyPreviewKind = cardPreview
    ? (cardPreview.lethal ? 'lethal' : cardPreview.hpDamage > 0 || cardPreview.rawDamage > 0 ? 'damage' : null)
    : null;
  const enemyPreviewLabel = cardPreview
    ? (cardPreview.lethal ? '처치!' : cardPreview.hpDamage > 0 ? `-${cardPreview.hpDamage}` : cardPreview.rawDamage > 0 ? `방어 -${Math.min(b.enemy.block, cardPreview.rawDamage)}` : '')
    : '';
  const playerPreviewKind = cardPreview && cardPreview.healGain > 0 ? 'heal' : null;
  const playerPreviewLabel = cardPreview && cardPreview.healGain > 0 ? `+${cardPreview.healGain}` : '';
  const stageStatus = (!inQuiz && deal.busy)
    ? '카드를 뽑는 중…'
    : enemyActing
      ? (combatEffect.kind === 'hurt' ? '적의 공격!' : '적이 행동하는 중…')
      : '';

  return <>
    {loading && <div className="battle-loading" role="status">
      <span className="battle-loading-ring" aria-hidden="true" />
      <span>전투를 불러오는 중…</span>
    </div>}
    <section ref={section} className={`battle-screen${busy ? ' is-animating' : ''}${inQuiz ? ' is-quizzing' : ''}`} aria-label="턴제 카드 전투" aria-busy={busy} inert={loading}>
      <div className="battle-stage">
        <div className="combat-hud is-slim">
          <section className="combatant-hud player-hud" aria-label="모험가 상태">
            <div className="combatant-heading"><h3>모험가</h3></div>
            <CombatHealthBar value={shownPlayerHP} max={run.maxHp} label="모험가 체력" motionPreference={motionPreference}
              block={shownBlock} previewBlockGain={cardPreview?.blockGain ?? 0}
              previewValue={cardPreview && cardPreview.healGain > 0 ? cardPreview.playerHpAfter : null}
              previewKind={playerPreviewKind} previewLabel={playerPreviewLabel} />
          </section>
          <span className="battle-turn" aria-label={`${b.turn}턴`}>TURN <strong>{String(b.turn).padStart(2, '0')}</strong></span>
          <section className="combatant-hud enemy-hud" aria-label="적 상태">
            <div className="combatant-heading"><h3>{MONSTERS[b.enemy.type].name}</h3></div>
            <CombatHealthBar value={shownEnemyHP} max={b.enemy.maxHp} label="적 체력" motionPreference={motionPreference}
              block={b.enemy.block}
              previewValue={cardPreview && cardPreview.hpDamage > 0 ? cardPreview.enemyHpAfter : null}
              previewKind={enemyPreviewKind} previewLabel={enemyPreviewLabel} />
          </section>
        </div>

        <div className="battlefield">
          <CombatScene enemy={b.enemy} effect={combatEffect} playerDead={fatal} cue={cue} motionPreference={motionPreference}
            playerIndicators={shownPlayerHP > 0 && <>
              {cardPreview && cardPreview.heroBadges.length > 0 && <div className="hero-preview-pills" aria-hidden="true">
                {cardPreview.heroBadges.map((badge) => <span key={badge.text} className={`hero-preview-pill tone-${badge.kind}`}>{badge.text}</span>)}
              </div>}
              <StatusBadges battle={b} compact busy={skillBusy} />
            </>}
            enemyIndicators={shownEnemyHP > 0 && <>
              <EnemyIntent intent={shownIntent} acting={enemyActing}
                playerBlock={shownBlock} playerHp={shownPlayerHP} locked={false} preview={cardPreview} />
              <StatusBadges battle={b} enemy compact busy={skillBusy} />
            </>}
            studying={Boolean(pending)} playerHealth={shownPlayerHP / run.maxHp}
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

          {run.relics.length > 0 && <div className="battle-relic-bar" aria-label="보유 유물">
            {run.relics.map((relic) => <BattleRelicChip key={relic.id} relic={relic} onInspect={onInspect} />)}
          </div>}

          {answerToast && <div key={answerToast.id} className={`battle-answer-toast is-${answerToast.tone ?? 'correct'}`} role="status" aria-live="polite">
            <span className="toast-check" aria-hidden="true">{answerToast.tone === 'wrong' ? '✕' : '✓'}</span>
            <strong lang="en">{answerToast.term}</strong>
            <span className="toast-sep" aria-hidden="true">=</span>
            <span className="toast-meaning">{answerToast.meaning}</span>
            {answerToast.badge && <small className="toast-card">{answerToast.badge}</small>}
          </div>}

          {stageStatus && <div className="battle-stage-status" role="status">{stageStatus}</div>}
        </div>
      </div>

      <div className={`battle-controls battle-dock${inQuiz ? ' is-quiz-mode' : ''}`}>
        <div className="dock-side dock-left">
          <CombatEnergy energy={shownEnergy} playable={playableCount}
            previewCost={infiniteEnergy ? 0 : (cardPreview?.cost ?? 0)}
            previewAfter={infiniteEnergy ? null : (cardPreview ? cardPreview.energyAfter : null)} />
          <button type="button" className="deck-pile draw-pile" onClick={() => onInspect?.('deck')}
            aria-label={`뽑을 카드 ${b.draw.length}장`} title={`뽑을 카드 ${b.draw.length}장 (클릭해 덱 보기)`}>
            <span className="pile-stack" aria-hidden="true"><GameIcon name="deck" /></span>
            <strong className="pile-count">{b.draw.length}</strong>
            <small className="pile-label">뽑기</small>
          </button>
        </div>

        {inQuiz ? (
          <BattleQuizDock
            question={pending?.question ?? feedback?.question}
            feedback={feedback}
            card={quizCard}
            cardName={selectedCard ? CARDS[selectedCard.type].name : (feedback?.cardName ?? '')}
            cardSummary={quizCardSummary}
            wordbooks={wordbooks}
            busy={loading || skillBusy || fatal}
            shortcutMode={shortcutConfirm}
            revealDuration={feedback && !feedback.correct ? wrongRevealMs : 0}
            showAnswerHint={showAnswerHint}
            onAnswer={handleAnswer}
            onSkipReveal={skipWrongReveal}
          />
        ) : (
          <div className="card-hand" style={{ '--hand-count': hand.length }} tabIndex={-1}
            data-initial-focus={!inQuiz && playableCount > 0 ? '' : undefined}
            data-keyboard-group aria-label="손에 든 카드">
            {hand.map((card, index) => {
              const playable = infiniteEnergy || CARDS[card.type].cost <= b.energy;
              const offset = index - (hand.length - 1) / 2;
              return <Card key={card.uid} card={card} compact shortcut={index < 5 ? index + 1 : undefined}
                style={{ '--card-offset': offset }}
                liveEffects={liveCardEffects(run, card)}
                hidden={deal.hidden.includes(card.uid)} disabled={locked || busy || !playable}
                onPreviewStart={(event) => {
                  if (event.type === 'focus') {
                    if (event.currentTarget.matches(':focus-visible')) setFocusedCardUid(card.uid);
                  } else {
                    const active = document.activeElement;
                    if (active instanceof HTMLElement && active !== event.currentTarget && active.matches('.card-hand .game-card')) {
                      active.blur();
                    }
                    setHoveredCardUid(card.uid);
                  }
                }}
                onPreviewEnd={(event) => {
                  if (event.type === 'blur') setFocusedCardUid((curr) => (curr === card.uid ? null : curr));
                  else setHoveredCardUid((curr) => (curr === card.uid ? null : curr));
                }}
                onClick={() => playCard(card.uid)} />;
            })}
            {!hand.length && <p className="empty-hand game-muted">손에 든 카드가 없어요. 턴을 종료해 새 카드를 뽑으세요.</p>}
          </div>
        )}

        <div className="dock-side dock-right">
          {b.exhaust.length > 0 && <button type="button" className="exhaust-pile" onClick={() => onInspect?.('log')}
            aria-label={`소멸 카드 ${b.exhaust.length}장`} title={`소멸된 카드 ${b.exhaust.length}장 (다음 전투에 복구)`}>
            <span aria-hidden="true">✦</span><strong>{b.exhaust.length}</strong>
          </button>}
          <button className={`game-primary end-turn${!locked && !busy && playableCount === 0 ? ' is-suggested' : ''}`}
            disabled={locked || busy}
            data-initial-focus={!inQuiz && !locked && playableCount === 0 ? '' : undefined}
            onClick={endTurn}><span>턴 종료</span><kbd className="end-turn-key" aria-hidden="true">↵</kbd></button>
          <button type="button" className="deck-pile discard-pile" onClick={() => onInspect?.('log')}
            aria-label={`버린 카드 ${b.discard.length}장, 소멸 ${b.exhaust.length}장`} title={`버린 카드 ${b.discard.length}장 · 소멸 ${b.exhaust.length}장`}>
            <span className="pile-stack" aria-hidden="true"><GameIcon name="deck" /></span>
            <strong className="pile-count">{b.discard.length}</strong>
            <small className="pile-label">버림</small>
          </button>
        </div>
      </div>

      <div ref={dealCanvas} className="card-deal-canvas" aria-hidden="true" />
    </section>
  </>;
}

function BattleLog({ battle }) {
  return <section className="combat-log" aria-label="전투 기록과 규칙">
    <h3>전투 기록 · 전투 규칙</h3>
    <p>뽑을 카드 {battle.draw.length} · 버린 카드 {battle.discard.length} · 소멸 {battle.exhaust.length}</p>
    <p>카드를 고른 뒤 영단어 문제를 맞히면 효과가 발동합니다. 소멸 카드는 다음 전투에서 돌아옵니다.</p>
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

function TierSelection({ progress, dispatch, onStarted, onTutorial }) {
  const admin = useAdmin();
  const transition = useSceneTransition();
  const selection = useRef(null);
  const startButton = useRef(null);
  const [tier, setTier] = useState('bronze');
  const ongoing = progress.run && progress.run.phase !== 'result';
  const wordbooks = progress.wordbooks ?? [];
  const personal = wordbooks.some((book) => book.id === tier);
  const pool = questionPool(tier, wordbooks);
  const unlocked = ADMIN_MODE && admin.cheats.unlockAllTiers ? TIERS.map((t) => t.id) : unlockedTierIds(progress);
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
          {onTutorial && <button type="button" className="tier-tutorial-button" aria-label="모험 튜토리얼" onClick={onTutorial}>
            <span className="tier-guide-title">모험 </span>튜토리얼
          </button>}
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

export default function AdventureDialog({ progress, dispatch, error, newAdventure, onTutorial, onClose, motionPreference, shortcutConfirm = 'single' }) {
  const dialog = useRef(null);
  const transition = useSceneTransition();
  const requestClose = () => transition(() => dialog.current.close());
  const [animateBattle, setAnimateBattle] = useState(false);
  const battleMenu = useRef(null);
  const [choosing, setChoosing] = useState(newAdventure);
  const [entering, setEntering] = useState(false);
  const [inspect, setInspect] = useState(null);
  const [battleHeroHp, setBattleHeroHp] = useState(null);
  const previousPhase = useRef(null);
  const run = progress.run;
  const activeInspect = run ? inspect : null;
  useEffect(() => { if (!run && inspect) setInspect(null); }, [run, inspect]);
  const wordbooks = progress.wordbooks ?? [];
  const book = wordbooks.find(({ id }) => id === run?.tier);
  const scopeLabel = book?.name ?? tierLabel(run?.tier);
  const entranceScope = book ? { id: 'personal', label: book.name, count: book.words.length } : TIERS.find(({ id }) => id === run?.tier);
  const returnToTitle = () => transition(() => dialog.current.close(run?.tier === 'bronze' && run.result?.won ? 'bronze-clear' : ''));
  const phase = choosing ? 'tier' : entering ? 'entry' : run?.phase;
  const inCombat = phase === 'battle' && !activeInspect;
  useEffect(() => { if (!inCombat) setBattleHeroHp(null); }, [inCombat]);
  const topHeroHp = inCombat && battleHeroHp !== null ? battleHeroHp : (run?.hp ?? 0);
  const openInspect = (id) => {
    if (battleMenu.current?.open) battleMenu.current.open = false;
    transition(() => { setAnimateBattle(false); setInspect(id); });
  };
  const titles = { tier: '새 모험', entry: '던전 입장', map: '던전 경로', battle: '카드 전투', reward: '모험의 보상', rest: '휴식', forge: '강화와 구입', result: '도전 결과' };
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  const quizId = run?.battle?.pending?.question.id;
  const feedback = !!run?.battle?.feedback;
  useEffect(() => {
    const target = dialog.current.querySelector('[data-initial-focus]:not(:disabled):not([inert] *)') ?? dialog.current.querySelector('.adventure-title');
    const enteringBattle = phase === 'battle' && previousPhase.current !== 'battle' && !activeInspect && !quizId && !feedback;
    target?.focus({ preventScroll: enteringBattle || inCombat || ['entry', 'map'].includes(phase) });
    if (phase === 'entry' || (phase === 'map' && !activeInspect && run.floor < 0) || (inCombat && !quizId && !feedback)) dialog.current.querySelector('.game-body').scrollTop = 0;
    previousPhase.current = phase;
  }, [phase, activeInspect, quizId, feedback, inCombat]);

  return <dialog ref={dialog} className={`game-dialog${inCombat ? ' is-battle' : ''}${phase === 'entry' ? ' is-entering' : ''}`} aria-labelledby="adventure-title" onClose={(event) => onClose(event.currentTarget.returnValue)} onKeyDown={navigateGameButtons}
    onPointerDown={(event) => { if (battleMenu.current?.open && !battleMenu.current.contains(event.target)) battleMenu.current.open = false; }}
    onCancel={(event) => { if (battleMenu.current?.open) { event.preventDefault(); battleMenu.current.open = false; battleMenu.current.querySelector('summary').focus(); } else { event.preventDefault(); requestClose(); } }}>
    {inCombat ? (
      <header className="game-header is-battle-topbar">
        <div className="topbar-stats">
          <h2 id="adventure-title" className="adventure-title sr-only" tabIndex={-1}>{`${run.floor + 1}층 · 카드 전투`}</h2>
          <span className="topbar-scope"><TierCrest tier={book ? 'personal' : run.tier} small /><strong>{scopeLabel}</strong></span>
          <span className={`topbar-stat is-hp${topHeroHp <= run.maxHp * 0.3 ? ' is-low' : ''}`} title={`체력 ${topHeroHp} / ${run.maxHp}`}>
            <GameIcon name="heart" /><strong>{topHeroHp}/{run.maxHp}</strong>
          </span>
          <span className="topbar-stat is-gold" title={`보유 금화 ${run.gold}`}>
            <GameIcon name="coin" /><strong>{run.gold}</strong>
          </span>
        </div>
        <div className="topbar-center">
          <span className="topbar-floor" title={`${run.floor + 1}층 / 전체 8층`}>
            <GameIcon name="stairs" /><strong>{run.floor + 1}</strong><small>/8층</small>
          </span>
          <span className="battle-save-status" title={error || '선택할 때마다 자동 저장'}>{error ? '저장 확인' : '자동 저장'}</span>
        </div>
        <div className="game-header-actions topbar-actions">
          <button type="button" className="topbar-icon-btn" aria-label="던전 경로" title="던전 경로" onClick={() => openInspect('map')}>
            <GameIcon name="map" />
          </button>
          <button type="button" className="topbar-icon-btn is-deck" aria-label={`나의 덱 · ${run.deck.length}장`} title={`나의 덱 · ${run.deck.length}장`} onClick={() => openInspect('deck')}>
            <GameIcon name="deck" />
            <em className="topbar-badge" aria-hidden="true">{run.deck.length}</em>
          </button>
          <details className="battle-menu" ref={battleMenu}>
            <summary aria-label="전투 메뉴" title="전투 메뉴"><GameIcon name="gear" /></summary>
            <div className="battle-menu-content"><p className="gold-text">◈ 금화 {run.gold}</p>
              <div data-keyboard-group>{[['deck', `나의 덱 · ${run.deck.length}장`], ['relics', `보유 유물 · ${run.relics.length}개`], ['map', '던전 경로'], ['log', '전투 기록 · 규칙']].map(([id, label]) =>
                <button key={id} onClick={() => openInspect(id)}>{label}</button>)}</div>
              <p>뽑을 카드 {run.battle.draw.length} · 버린 카드 {run.battle.discard.length} · 소멸 {run.battle.exhaust.length}</p>
            </div>
          </details>
          <button className="settings-close" aria-label="모험 닫고 타이틀로" title="모험 닫고 타이틀로" onClick={requestClose}>×</button>
        </div>
      </header>
    ) : (
      <header className="game-header"><div><p className="game-eyebrow">{phase === 'tier' ? '새 모험' : scopeLabel}</p>
        <h2 id="adventure-title" className="adventure-title" tabIndex={-1}>{activeInspect === 'deck' ? '나의 덱' : activeInspect === 'relics' ? '보유 유물' : activeInspect === 'map' ? '던전 경로' : activeInspect === 'log' ? '전투 기록' : titles[phase]}</h2></div>
        <div className="game-header-actions">
          <button className="settings-close" aria-label="모험 닫고 타이틀로" onClick={requestClose}>×</button>
        </div></header>
    )}
    {error && <p role="alert" className="game-save-error">{error}</p>}
    {!choosing && run && !['result', 'entry'].includes(phase) && !inCombat && <div className="run-toolbar"><div><TierCrest tier={book ? 'personal' : run.tier} small /><span>{run.floor < 0 ? '입구' : `${run.floor + 1}층 / 8`}</span><span className="hp-text">HP {run.hp}/{run.maxHp}</span><span className="gold-text">◈ {run.gold}</span></div>
      <div className="run-inspect-buttons">{[['deck', `덱 ${run.deck.length}`], ['relics', `유물 ${run.relics.length}`], ['map', '경로']].map(([id, label]) => <button key={id} className="game-secondary" aria-pressed={activeInspect === id} onClick={() => transition(() => { setAnimateBattle(false); setInspect(activeInspect === id ? null : id); })}>{label}</button>)}</div></div>}
    <div className="game-body">
      {activeInspect ? <section className="inspection"><button className="game-secondary inspect-back" data-initial-focus onClick={() => transition(() => setInspect(null))}>← 모험으로 돌아가기</button>
        {activeInspect === 'deck' ? <div className="deck-inspection">{run.deck.map((card) => <div className="deck-item" key={card.uid}><strong>{CARDS[card.type].name}{card.upgraded && '+'}</strong><span>에너지 {CARDS[card.type].cost} · {CARDS[card.type].rarity}</span><p>{describeCard(card)}</p></div>)}</div>
          : activeInspect === 'relics' ? run.relics.map((relic) => <Relic key={relic.id} relic={relic} />) : activeInspect === 'log' ? <BattleLog battle={run.battle} /> : <DungeonMap run={run} inspecting motionPreference={motionPreference} />}
      </section> : choosing ? <TierSelection progress={progress} dispatch={dispatch} onTutorial={onTutorial} onStarted={() => { setChoosing(false); setEntering(true); }} />
        : phase === 'entry' ? <DungeonEntrance tier={entranceScope} motionPreference={motionPreference} onComplete={() => transition(() => setEntering(false))} />
        : phase === 'map' ? <DungeonMap key={run.floor} run={run} motionPreference={motionPreference} onSelect={(id) => transition(() => { if (dispatch({ type: 'SELECT_NODE', id })) setAnimateBattle(true); })} />
          : phase === 'battle' ? <Battle key={run.floor} run={run} wordbooks={wordbooks} dispatch={dispatch} motionPreference={motionPreference} shortcutConfirm={shortcutConfirm} animateOpening={animateBattle} onOpeningDone={() => setAnimateBattle(false)} onInspect={openInspect} onHeroHpChange={setBattleHeroHp} />
            : phase === 'reward' ? <Reward run={run} dispatch={(action) => action.type === 'LEAVE_REWARD' ? transition(() => dispatch(action)) : dispatch(action)} />
              : ['rest', 'forge'].includes(phase) ? <Services key={`${phase}-${run.floor}`} run={run} dispatch={(action) => action.type === 'LEAVE_FORGE' || phase === 'rest' ? transition(() => dispatch(action)) : dispatch(action)} />
                : phase === 'result' ? <Result run={run} scopeLabel={scopeLabel} progress={progress} onClose={returnToTitle} /> : <p>이어서 진행할 모험이 없습니다.</p>}
    </div>
    {!inCombat && !['tier', 'entry', 'map'].includes(phase) && <footer className="game-footer"><span><kbd>방향키</kbd> 항목 이동 <kbd>Enter</kbd> 선택 <kbd>Esc</kbd> 타이틀</span><span>{error ? '저장 상태를 확인하세요' : '선택할 때마다 자동 저장'}</span></footer>}
    <TransitionVeil />
  </dialog>;
}
