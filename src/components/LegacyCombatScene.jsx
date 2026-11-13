import { useEffect, useRef, useState } from 'react';

export default function LegacyCombatScene({ enemy, playback, motionPreference = 'normal', onReady, onError, onController, playerDead = false }) {
  const host = useRef(null);
  const renderer = useRef(null);
  const latest = useRef(null);
  latest.current = { enemy, playerDead, motion: motionPreference, onReady, onError, onController };
  const [error, setError] = useState(false);
  const monsterType = enemy.type;

  useEffect(() => {
    let cancelled = false;
    let controller;
    const timeout = setTimeout(fail, 20_000);

    function fail() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timeout);
      renderer.current = null;
      latest.current.onController?.(null);
      controller?.destroy();
      setError(true);
      latest.current.onError?.();
    }

    setError(false);
    import('../game/combatScene.js').then(({ startCombatScene }) => {
      if (cancelled) return;
      controller = startCombatScene(host.current, monsterType, {
        playback,
        onReady: () => {
          if (cancelled) return;
          clearTimeout(timeout);
          latest.current.onReady?.();
        },
      });
      renderer.current = controller;
      latest.current.onController?.(controller);
      controller.setState(latest.current);
    }).catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      renderer.current = null;
      latest.current.onController?.(null);
      controller?.destroy();
    };
  }, [monsterType, playback]);

  useEffect(() => {
    renderer.current?.setState({ enemy, playerDead, motion: motionPreference });
  }, [enemy, playerDead, motionPreference]);

  return <>
    <div ref={host} className="combat-canvas" aria-hidden="true" />
    {error && <p className="combat-scene-error" role="status">전투 그림을 불러오지 못했어요. 카드 전투는 계속할 수 있어요.</p>}
  </>;
}
