import { useEffect, useRef } from 'react';

export default function TitleScene({ motionPreference = 'normal' }) {
  const canvas = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    import('../game/titleScene.js').then(({ startPhaserTitleScene }) => {
      if (!controller.signal.aborted) startPhaserTitleScene(canvas.current, { signal: controller.signal, motionPreference });
    }).catch((error) => {
      if (!controller.signal.aborted) console.warn('배경 애니메이션을 불러오지 못했습니다.', error);
    });
    const syncVisibility = () => document.documentElement.classList.toggle('paused', document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', syncVisibility);
      document.documentElement.classList.remove('paused');
    };
  }, [motionPreference]);
  return <div className="scene" aria-hidden="true"><canvas ref={canvas} id="scene" /></div>;
}
