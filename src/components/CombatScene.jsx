import { useEffect, useRef, useState } from 'react';
import { CombatPlayback, combatMotionMode } from '../game/three/playback.js';
import SceneView from './SceneView.jsx';
import LegacyCombatScene from './LegacyCombatScene.jsx';

export default function CombatScene({
  enemy, effect, playerDead = false, cue, motionPreference, onBusy, onReady, onError, onImpact, onController,
}) {
  const latest = useRef(null);
  latest.current = { onBusy, onImpact };
  const timers = useRef(new Set());
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const mode = combatMotionMode(motionPreference, systemReduced);

  function showResult(result) {
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
    onImpact: (index, target, hit) => {
      latest.current.onImpact?.(index, target, hit);
      showResult({ ...hit, id: `${hit.effectId}-${index}`, label: hit.blocked ? '방어' : hit.amount });
    },
    onMoment: ({ effect: current, plan }) => {
      if (current.amount > 0) {
        showResult({
          id: `${current.id}-moment`, index: 0, target: plan.role === 'curse' ? 'enemy' : 'player',
          label: `+${current.amount}`,
        });
      }
    },
  }));

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
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    };
  }, [playback]);

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
  return <div className={`combat-scene effect-${effect.kind}`} data-motion={mode}>
    <SceneView mode="battle" state={state} playback={playback} playbackBusy={busy}
      callbacks={{ onReady }} motionPreference={motionPreference} onController={onController}
      fallback={<LegacyCombatScene {...state} playback={playback} motionPreference={motionPreference}
        onReady={onReady} onError={fail} />} />
    {results.map((result) => <span key={result.id}
      className={`combat-hit-number${result.target === 'player' ? ' is-player' : ''}${result.heavy ? ' is-heavy' : ''}${result.blocked ? ' is-blocked' : ''}`}
      style={{ '--hit-x': `${(result.index % 2 ? 1 : -1) * (result.index ? 28 : 0)}px`, '--hit-y': `${-result.index * 18}px` }}
      aria-hidden="true">{result.label}</span>)}
    <span className="scene-vignette" aria-hidden="true" />
  </div>;
}
