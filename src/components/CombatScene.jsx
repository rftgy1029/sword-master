import { useEffect, useRef, useState } from 'react';

export default function CombatScene({ enemy, effect, motionPreference = 'normal', onBusy, onReady, onError, onImpact, playerDead = false }) {
  const host = useRef(null);
  const renderer = useRef(null);
  const latest = useRef({ effect, enemy, motion: motionPreference });
  const busyCallback = useRef(onBusy);
  const readyCallback = useRef(onReady);
  const errorCallback = useRef(onError);
  const impactCallback = useRef(onImpact);
  impactCallback.current = onImpact;
  readyCallback.current = onReady;
  errorCallback.current = onError;
  busyCallback.current = onBusy;
  const [error, setError] = useState(null);
  const monsterType = enemy.type;
  latest.current = { effect, enemy, playerDead, motion: motionPreference };

  useEffect(() => {
    let cancelled = false;
    let controller;
    const timeout = setTimeout(() => fail(new Error('전투 로딩 시간 초과')), 20_000);

    function fail(error) {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
      renderer.current = null;
      controller?.destroy();
      console.warn('전투 그림을 불러오지 못했습니다.', error);
      setError('전투 그림을 불러오지 못했어요. 카드 전투는 계속할 수 있어요.');
      errorCallback.current?.();
    }

    setError(null);
    // Load Phaser only when a battle is opened, keeping the title screen small.
    import('../game/combatScene.js').then(({ startCombatScene }) => {
      if (cancelled) return;
      controller = startCombatScene(host.current, monsterType, { initialEffectId: latest.current.effect.id,
        onImpact: (index, target) => { if (!cancelled) impactCallback.current?.(index, target); },
        onReady: () => {
          if (cancelled) return;
          clearTimeout(timeout);
          readyCallback.current?.();
        },
        onBusy: (value) => { if (!cancelled) busyCallback.current?.(value); } });
      renderer.current = controller;
      controller.setState(latest.current);
    }).catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
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
