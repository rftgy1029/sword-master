import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CARDS, MONSTERS } from '../src/game/catalog.js';
import { startCombatScene } from '../src/game/combatScene.js';
import { startCardDealScene } from '../src/game/cardDealScene.js';
import { emptyProgress, gameReducer, reachableNodes } from '../src/game/engine.js';
import { enemyAttackPlan } from '../src/game/enemyAttackTimeline.js';
import '../styles.css';
import '../src/components/adventure.css';

function Preview() {
  const arena = useRef(null), dealer = useRef(null), combat = useRef(null), draw = useRef(null);
  const effectId = useRef(0), automatic = useRef(false), current = useRef(0), timer = useRef(null);
  const impacts = useRef([]);
  const enemyImpacts = useRef([]);
  const busyEvents = useRef([]);
  const [enemyType, setEnemyType] = useState('ember');
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [status, setStatus] = useState('장면 준비 중');
  const [upgraded, setUpgraded] = useState(false), [motion, setMotion] = useState('normal');
  const [diagnostic, setDiagnostic] = useState('');
  useEffect(() => {
    const interval = setInterval(() => setDiagnostic(JSON.stringify(combat.current?.inspect())), 500);
    return () => clearInterval(interval);
  }, []);
  const playRef = useRef(null), motionRef = useRef(motion);
  motionRef.current = motion;
  const types = Object.keys(CARDS);
  useEffect(() => {
    setReady(false);
    setBusy(false);
    combat.current = startCombatScene(arena.current, enemyType, {
      initialEffectId: effectId.current,
      onImpact: (index, target) => target === 'player' ? enemyImpacts.current.push(index) : impacts.current.push(index),
      onReady: () => { setReady(true); setStatus('장면 준비 완료'); },
      onBusy: (value) => {
        busyEvents.current.push(value);
        setBusy(value);
        if (!value && automatic.current) {
          const count = ++current.current;
          setStatus('실제 Phaser 기술 재생 완료 ' + count + ' / ' + types.length);
          if (count === types.length) automatic.current = false;
          else timer.current = setTimeout(() => playRef.current(types[count]), 180);
        }
      },
    });
    combat.current.setState({ effect: { id: effectId.current, kind: 'start', amount: 0 }, enemy: { type: enemyType, hp: 1000 }, motion: motionRef.current });
    return () => { clearTimeout(timer.current); automatic.current = false; combat.current.destroy(); };
  }, [enemyType]);
  useEffect(() => {
    draw.current = startCardDealScene(dealer.current);
    const onError = (event) => { automatic.current = false; setStatus('오류: ' + event.message); };
    window.addEventListener('error', onError);
    return () => { window.removeEventListener('error', onError); draw.current.destroy(); };
  }, []);
  const play = (type, miss = false) => {
    const card = CARDS[type];
    combat.current.setState({
      effect: { id: ++effectId.current, kind: miss ? 'miss' : card.damage ? 'attack' : card.heal ? 'heal' : 'block', cardType: type, upgraded, amount: card.damage ?? card.heal ?? card.block ?? 2 },
      enemy: { type: enemyType, hp: 1000 }, motion,
    });
    if (!automatic.current) setStatus(card.name + (miss ? ' · 오답' : ' · 기술 재생'));
  };
  playRef.current = play;
  const playEnemy = (blocked = false, fatal = false) => {
    let p = gameReducer(emptyProgress(), { type: 'START', tier: 'bronze', seed: 42 });
    p = gameReducer(p, { type: 'SELECT_NODE', id: reachableNodes(p.run)[0].id });
    Object.assign(p.run.battle.enemy, { type: enemyType, step: MONSTERS[enemyType].pattern.findIndex((intent) => intent.kind === 'attack') });
    p.run.battle.block = blocked ? 100 : 0;
    const result = gameReducer(p, { type: 'END_TURN' });
    const effect = { ...result.run.battle.effect, id: ++effectId.current };
    combat.current.setState({ effect, enemy: result.run.battle.enemy, playerDead: fatal, motion });
    setStatus(MONSTERS[enemyType].name + ' · ' + (blocked ? '전부 방어' : fatal ? '치명타' : '공격') + ' · 피해 ' + effect.impacts.join(' + '));
    return effect;
  };
  const validateEnemy = () => {
    const results = [];
    automatic.current = false; clearTimeout(timer.current);
    for (const mode of ['attack', 'blocked', 'fatal']) {
      combat.current.settlePreview(); enemyImpacts.current = []; busyEvents.current = [];
      const effect = playEnemy(mode === 'blocked', mode === 'fatal'), plan = enemyAttackPlan(enemyType, effect);
      const first = combat.current.advancePreview(500, { width: 740, height: 330 });
      const middle = combat.current.advancePreview(300);
      const end = combat.current.advancePreview(plan.duration - 800);
      if (!first.active || !first.pendingResize || !middle.active || end.active || end.pendingResize || Math.abs(end.enemyX - end.home) > .01 ||
        enemyImpacts.current.join(',') !== plan.hits.map((_, i) => i).join(',') || busyEvents.current.join(',') !== 'true,false' || (mode === 'fatal' && end.heroAlpha > .21)) {
        setStatus('몬스터 검사 실패 ' + JSON.stringify({ first, middle, end, hits: enemyImpacts.current })); return;
      }
      results.push(({ attack: '공격', blocked: '방어', fatal: '치명타' })[mode] + ' ' + plan.hits.length + '회');
    }
    combat.current.settlePreview(); setBusy(false);
    combat.current.advancePreview(0, { width: arena.current.clientWidth, height: arena.current.clientHeight });
    setStatus(MONSTERS[enemyType].name + ' 실제 Scene 통과: ' + results.join(' / ') + ' · 피해 콜백·도중 리사이즈·복귀·입력 잠금 해제');
  };
  const validate = () => {
    automatic.current = false;
    clearTimeout(timer.current);
    const results = [];
    for (const type of types) {
      combat.current.settlePreview();
      play(type);
      const objects = combat.current.sampleFrame(220);
      results.push(CARDS[type].name + ':' + objects);
      if (!objects) { setStatus('프레임 검사 실패: ' + type); return; }
    }
    combat.current.settlePreview(); setBusy(false);
    setStatus('실제 Canvas 렌더 12종 통과 · ' + results.join(' / '));
  };
  const validateTimeline = () => {
    automatic.current = false; clearTimeout(timer.current);
    const results = [];
    for (const type of types.filter((id) => CARDS[id].damage)) {
      combat.current.settlePreview(); impacts.current = []; play(type);
      const first = combat.current.advancePreview(600, { width: 740, height: 330 });
      const middle = combat.current.advancePreview(600);
      const end = combat.current.advancePreview(800);
      const hits = CARDS[type].hits ?? 1;
      if (!first.active || !first.pendingResize || !middle.active || end.active || end.pendingResize || end.width !== 740 || impacts.current.length !== hits) {
        setStatus('공격 타임라인 실패: ' + type + JSON.stringify({ first, middle, end, impacts: impacts.current })); return;
      }
      results.push(CARDS[type].name + ' ' + hits + '회');
    }
    combat.current.settlePreview(); setBusy(false);
    combat.current.advancePreview(0, { width: arena.current.clientWidth, height: arena.current.clientHeight });
    setStatus('실제 Scene update 2000ms·도중 리사이즈·피해 횟수·완료 통과: ' + results.join(' / '));
  };
  const deal = async () => {
    setBusy(true); setStatus('실제 Phaser 덱 → 손패 드로우 검증 중');
    const base = dealer.current.getBoundingClientRect();
    const point = (element) => { const r = element.getBoundingClientRect(); return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top, width: r.width, height: r.height }; };
    const arrivals = [];
    const targets = [...document.querySelectorAll('[data-destination]')].map(point);
    await draw.current.play({ cards: types.slice(0, 5).map((type, i) => ({ type, uid: String(i) })), targets,
      source: point(document.querySelector('[data-source]')), discard: point(document.querySelector('[data-source]')),
      reshuffle: true, onArrive: (uid) => { arrivals.push(uid); setStatus('도착 순서: ' + arrivals.join(' → ')); } });
    setBusy(false); setStatus(arrivals.join(',') === '0,1,2,3,4' ? '드로우 5장 순서·완료 통과' : '드로우 순서 오류: ' + arrivals.join(','));
  };
  return <main style={{ padding: 20, maxWidth: 1320, margin: 'auto' }}>
    <h1 style={{ fontSize: 24 }}>S’word Master · 연출 검증</h1>
    <p>학습·모험 저장 기록을 사용하지 않는 개발용 장면입니다.</p>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <select aria-label="몬스터" value={enemyType} onChange={(e) => setEnemyType(e.target.value)}>{Object.entries(MONSTERS).map(([id, m]) => <option key={id} value={id}>{m.name}</option>)}</select>
      <select aria-label="모션 설정" value={motion} onChange={(e) => setMotion(e.target.value)}><option value="normal">풍부한 연출</option><option value="reduced">줄이기</option><option value="off">끄기</option></select>
      <label><input type="checkbox" checked={upgraded} onChange={(e) => setUpgraded(e.target.checked)} />강화 카드</label>
      <button disabled={!ready || busy} onClick={() => { automatic.current = true; current.current = 0; play(types[0]); }}>12종 자동 재생</button>
      <button disabled={!ready} onClick={validate}>12종 프레임 검사</button>
      <button disabled={!ready} onClick={validateTimeline}>공격 2초·크기 변경 검사</button>
      <button disabled={!ready || busy} onClick={() => playEnemy()}>몬스터 공격</button>
      <button disabled={!ready || busy} onClick={() => playEnemy(true)}>몬스터 공격 전부 방어</button>
      <button disabled={!ready || busy} onClick={() => playEnemy(false, true)}>몬스터 치명타</button>
      <button disabled={!ready} onClick={validateEnemy}>몬스터 공격·방어·크기 검사</button>
      {[450, 1000, 1600].map((ms) => <button key={ms} disabled={!ready} onClick={() => combat.current.sampleFrame(ms)}>현재 기술 {ms}ms</button>)}
      {[650, 1100, 1750].map((ms) => <button key={ms} disabled={!ready} onClick={() => { play('nova'); combat.current.sampleFrame(ms); }}>낙인 {ms}ms</button>)}
      <button disabled={!ready || busy} onClick={deal}>덱에서 5장 뽑기</button>
      <button disabled={!ready} onClick={() => { draw.current.sampleFrame(600); setStatus('드로우 600ms 실제 프레임'); }}>드로우 중간 프레임</button>
      <button disabled={!ready} onClick={() => draw.current.sampleFrame(1500)}>드로우 완료 프레임</button>
      <button disabled={!ready || busy} onClick={() => play('strike', true)}>오답</button>
    </div>
    <output role="status" style={{ display: 'block', padding: 12, border: '1px solid #ad955c', color: '#ffdb9b', marginBottom: 12 }}>{status}</output>
    <output style={{ display: 'block', fontSize: 12 }}>{diagnostic}</output>
    <div style={{ position: 'relative' }}>
      <div ref={arena} style={{ height: 420, position: 'relative', overflow: 'hidden' }} className="combat-canvas-preview" />
      <div data-source style={{ position: 'absolute', left: 16, bottom: 24, width: 38, height: 50, border: '2px solid #d9ba70', background: '#1f382b', display: 'grid', placeItems: 'center' }}>✦</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '28px 70px', minHeight: 180 }}>{types.slice(0,5).map((type) => <div data-destination key={type} style={{ flex: '0 1 166px', height: 145, border: '1px solid #748567', padding: 12 }}>{CARDS[type].name}</div>)}</div>
      <div ref={dealer} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }} />
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{types.map((type) => <button className="game-secondary" disabled={!ready || busy} key={type} onClick={() => play(type)}>{CARDS[type].name}</button>)}</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
