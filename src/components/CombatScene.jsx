import { useEffect, useRef, useState } from 'react';

export default function CombatScene({ enemy, effect, motionPreference = 'normal', onBusy, onReady, onImpact, playerDead = false }) {
  const host = useRef(null);
  const renderer = useRef(null);
  const latest = useRef({ effect, enemy, motion: motionPreference });
  const busyCallback = useRef(onBusy);
  const readyCallback = useRef(onReady);
  const impactCallback = useRef(onImpact);
  impactCallback.current = onImpact;
  readyCallback.current = onReady;
  busyCallback.current = onBusy;
  const [error, setError] = useState(null);
  const monsterType = enemy.type;
  latest.current = { effect, enemy, playerDead, motion: motionPreference };

  useEffect(() => {
    let cancelled = false;
    let controller;
    setError(null);
    // Load Phaser only when a battle is opened, keeping the title screen small.
    import('../game/combatScene.js').then(({ startCombatScene }) => {
      if (cancelled) return;
      controller = startCombatScene(host.current, monsterType, { initialEffectId: latest.current.effect.id,
        onImpact: (index, target) => { if (!cancelled) impactCallback.current?.(index, target); },
        onReady: () => { if (!cancelled) readyCallback.current?.(); }, onBusy: (value) => { if (!cancelled) busyCallback.current?.(value); } });
      renderer.current = controller;
      controller.setState(latest.current);
    }).catch(() => {
      if (!cancelled) { readyCallback.current?.(); busyCallback.current?.(false); setError('전투 그림을 불러오지 못했습니다. 새로고침해 주세요.'); }
    });
    return () => {
      cancelled = true;
      renderer.current = null;
      controller?.destroy();
    };
  }, [monsterType]);

  useEffect(() => { renderer.current?.setState({ effect, enemy, playerDead, motion: motionPreference }); }, [effect, enemy, playerDead, motionPreference]);

  return <div className={`combat-scene effect-${effect.kind}`}>
    <div ref={host} className="combat-canvas" aria-hidden="true" />
    {error && <p className="combat-scene-error" role="status">{error}</p>}
    {effect.amount > 0 && !['attack', 'hurt'].includes(effect.kind) && <span key={effect.id} className="combat-number" aria-hidden="true">+{effect.amount}</span>}
    <span className="scene-vignette" aria-hidden="true" />
  </div>;
}
