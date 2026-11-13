import { useCallback, useEffect, useRef, useState } from 'react';
import { createCombatAudio } from '../game/combatAudio.js';
import { useGraphics } from './GraphicsContext.jsx';
import { CombatPlayback, combatMotionMode } from '../game/three/playback.js';
import SceneView from './SceneView.jsx';
import LegacyCombatScene from './LegacyCombatScene.jsx';

export default function CombatScene({
  enemy, effect, playerDead = false, cue, motionPreference, onBusy, onReady, onError, onImpact, onController,
  playerIndicators, enemyIndicators,
}) {
  const latest = useRef(null);
  latest.current = { onBusy, onImpact };
  const timers = useRef(new Set());
  const scene = useRef(null);
  const overlay = useRef(null);
  const overheads = useRef({});
  const bounds = useRef({ width: 0, height: 0, player: {}, enemy: {} });
  const anchors = useRef(null);
  const positionIndicators = useCallback((points) => {
    anchors.current = points;
    const box = bounds.current;
    if (!points || !box.width || !box.height) return;
    for (const side of ['player', 'enemy']) {
      const node = overheads.current[side], point = points[side], size = box[side];
      if (!node || !point) continue;
      const x = Math.max(size.width / 2 + 6, Math.min(box.width - size.width / 2 - 6, point.x * box.width));
      const y = Math.max(size.height + 6, Math.min(box.height - 6, point.y * box.height));
      node.style.left = `${x.toFixed(1)}px`;
      node.style.top = `${y.toFixed(1)}px`;
      node.style.visibility = point.visible === false ? 'hidden' : 'visible';
      node.dataset.renderer = points.renderer;
    }
  }, []);
  useEffect(() => {
    const measure = () => {
      const host = overlay.current, player = overheads.current.player, enemy = overheads.current.enemy;
      if (!host || !player || !enemy) return;
      bounds.current = {
        width: host.clientWidth, height: host.clientHeight,
        player: { width: player.offsetWidth, height: player.offsetHeight },
        enemy: { width: enemy.offsetWidth, height: enemy.offsetHeight },
      };
      positionIndicators(anchors.current);
    };
    const observer = new ResizeObserver(measure);
    [overlay.current, ...Object.values(overheads.current)].forEach(node => observer.observe(node));
    measure();
    return () => observer.disconnect();
  }, [positionIndicators]);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const mode = combatMotionMode(motionPreference, systemReduced);
  const { combatSound = 'on', combatVolume = 60 } = useGraphics();
  const [audio] = useState(createCombatAudio);

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
    <SceneView mode="battle" state={state} playback={playback} playbackBusy={busy} onAnchors={positionIndicators}
      callbacks={{ onReady }} motionPreference={motionPreference} onController={(controller) => {
        scene.current = controller;
        onController?.(controller);
      }}
      fallback={<LegacyCombatScene {...state} playback={playback} motionPreference={motionPreference}
        onReady={onReady} onError={fail} onAnchors={positionIndicators} />} />
    <div className="combat-overheads">
      <div ref={node => { overheads.current.player = node; }} className="combat-overhead is-player">{playerIndicators}</div>
      <div ref={node => { overheads.current.enemy = node; }} className="combat-overhead is-enemy">{enemyIndicators}</div>
    </div>
    {results.map((result) => <span key={result.id}
      className={`combat-hit-number${result.target === 'player' ? ' is-player' : ''}${result.heavy ? ' is-heavy' : ''}${result.blocked ? ' is-blocked' : ''}`}
      style={{ left: result.left === undefined ? undefined : `${result.left}%`, top: result.top === undefined ? undefined : `${result.top}%`, '--hit-x': `${(result.index % 2 ? 1 : -1) * (result.index ? 28 : 0)}px`, '--hit-y': `${-result.index * 18}px` }}
      aria-hidden="true">{result.label}</span>)}
    <span className="scene-vignette" aria-hidden="true" />
  </div>;
}
