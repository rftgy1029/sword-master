import { useCallback, useEffect, useRef, useState } from 'react';
import { createCombatAudio } from '../game/combatAudio.js';
import { useGraphics } from './GraphicsContext.jsx';
import { CombatPlayback, combatMotionMode } from '../game/three/playback.js';
import SceneView from './SceneView.jsx';
import LegacyCombatScene from './LegacyCombatScene.jsx';
import OverheadStatus from './OverheadStatus.jsx';
import { anchorPercent } from '../game/overhead.js';

export default function CombatScene({
  enemy, effect, playerDead = false, cue, motionPreference, onBusy, onReady, onError, onImpact, onController, overhead,
}) {
  const latest = useRef(null);
  latest.current = { onBusy, onImpact };
  const timers = useRef(new Set());
  const scene = useRef(null);
  const overlay = useRef(null);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const mode = combatMotionMode(motionPreference, systemReduced);
  const { combatSound = 'on', combatVolume = 60 } = useGraphics();
  const [audio] = useState(createCombatAudio);
  const legacy = useRef(null);
  const [anchors, setAnchors] = useState(null);
  const measureTimers = useRef(new Set());
  const busyNow = useRef(false);
  busyNow.current = busy;

  // 머리 위 표시 위치: 연출이 없을 때 3D 액터(또는 2D 그림)의 머리 위 지점을 재서 백분율로 저장한다.
  const measureAnchors = useCallback(() => {
    const host = overlay.current;
    if (!host || busyNow.current) return;
    const box = host.getBoundingClientRect();
    const three = host.querySelector('canvas[data-renderer="three"]') && scene.current?.top ? scene.current : null;
    const points = three ? { hero: three.top('actor-hero'), enemy: three.top(`actor-${enemy.type}`) } : legacy.current?.anchors?.();
    if (!points) return;
    setAnchors((previous) => {
      const hero = anchorPercent(points.hero, box) ?? previous?.hero, foe = anchorPercent(points.enemy, box) ?? previous?.enemy;
      if (!hero || !foe) return previous;
      const same = previous && [['hero', hero], ['enemy', foe]].every(([side, next]) =>
        Math.abs(previous[side].left - next.left) < .2 && Math.abs(previous[side].top - next.top) < .2);
      return same ? previous : { hero, enemy: foe };
    });
  }, [enemy.type]);
  const scheduleAnchors = useCallback(() => {
    for (const timer of measureTimers.current) clearTimeout(timer);
    measureTimers.current.clear();
    for (const delay of [120, 450]) {
      const timer = setTimeout(() => { measureTimers.current.delete(timer); measureAnchors(); }, delay);
      measureTimers.current.add(timer);
    }
  }, [measureAnchors]);

  function showResult(result) {
    const canvas = overlay.current?.querySelector('canvas[data-renderer="three"]');
    const box = overlay.current?.getBoundingClientRect();
    if (canvas && box && scene.current?.project) {
      const point = scene.current.project([result.target === 'player' ? -2.15 : 2.2, 1.38, .3]);
      result.left = Math.min(90, Math.max(10, (point.x - box.left) / box.width * 100));
      result.top = Math.min(80, Math.max(14, (point.y - box.top) / box.height * 100));
    }
    setResults((list) => [...list, result]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setResults((list) => list.filter(({ id }) => id !== result.id));
    }, 950);
    timers.current.add(timer);
  }

  const [playback] = useState(() => new CombatPlayback({
    initialEffectId: effect.id,
    onBusy: (value, effectId) => {
      setBusy(value);
      latest.current.onBusy?.(value, effectId);
    },
    onStart: audio.start,
    onFrame: audio.frame,
    onImpact: (index, target, hit, current) => {
      audio.impact(hit, current);
      latest.current.onImpact?.(index, target, hit);
      if (hit.amount > 0 || hit.blocked) showResult({ ...hit, id: `${hit.effectId}-${index}`, label: hit.blocked ? '방어' : hit.amount });
    },
    onMoment: (current) => {
      audio.moment(current);
      const { effect, plan } = current;
      if (effect.amount > 0) {
        showResult({
          id: `${effect.id}-moment`, index: 0, target: plan.role === 'curse' ? 'enemy' : 'player',
          label: `+${effect.amount}`,
        });
      }
    },
  }));

  useEffect(() => {
    audio.configure(combatSound === 'on', combatVolume);
    const unlock = () => {
      audio.unlock();
      audio.configure(combatSound === 'on', combatVolume);
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [audio, combatSound, combatVolume]);

  useEffect(() => { if (!busy) scheduleAnchors(); }, [busy, scheduleAnchors]);
  useEffect(() => {
    const host = overlay.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => scheduleAnchors());
    observer.observe(host);
    return () => {
      observer.disconnect();
      for (const timer of measureTimers.current) clearTimeout(timer);
      measureTimers.current.clear();
    };
  }, [scheduleAnchors]);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    playback.disposed = false;
    return () => {
      playback.dispose();
      audio.dispose();
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    };
  }, [audio, playback]);

  useEffect(() => {
    if (playback.active && playback.active.mode !== mode && mode !== 'full') playback.finish();
    playback.start(effect, {
      monsterType: enemy.type,
      lethal: enemy.hp <= 0,
      playerDead,
      cue,
    }, failed ? 'instant' : mode);
  }, [playback, effect, enemy.type, enemy.hp, playerDead, cue, mode, failed]);

  function fail() {
    setFailed(true);
    playback.finish();
    onError?.();
  }

  const state = { enemy, playerDead };
  return <div ref={overlay} className={`combat-scene effect-${effect.kind}`} data-motion={mode}>
    <SceneView mode="battle" state={state} playback={playback} playbackBusy={busy}
      callbacks={{ onReady: () => { scheduleAnchors(); onReady?.(); } }} motionPreference={motionPreference} onController={(controller) => {
        scene.current = controller;
        onController?.(controller);
      }}
      fallback={<LegacyCombatScene {...state} playback={playback} motionPreference={motionPreference}
        onController={(controller) => { legacy.current = controller; }}
        onReady={() => { scheduleAnchors(); onReady?.(); }} onError={fail} />} />
    {overhead && <OverheadStatus {...overhead} busy={busy || !!overhead.busy} anchors={anchors} />}
    {results.map((result) => <span key={result.id}
      className={`combat-hit-number${result.target === 'player' ? ' is-player' : ''}${result.heavy ? ' is-heavy' : ''}${result.blocked ? ' is-blocked' : ''}`}
      style={{ left: result.left === undefined ? undefined : `${result.left}%`, top: result.top === undefined ? undefined : `${result.top}%`, '--hit-x': `${(result.index % 2 ? 1 : -1) * (result.index ? 28 : 0)}px`, '--hit-y': `${-result.index * 18}px` }}
      aria-hidden="true">{result.label}</span>)}
    <span className="scene-vignette" aria-hidden="true" />
  </div>;
}
