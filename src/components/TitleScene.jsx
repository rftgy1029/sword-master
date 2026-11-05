import { useEffect, useRef } from 'react';
import { startTitleScene } from '../scene.js';

export default function TitleScene({ motionPreference = 'normal', storyAction, heroOffset = 0, hideHero = false }) {
  const canvas = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    startTitleScene(canvas.current, { signal: controller.signal, motionPreference, storyAction, heroOffset, hideHero }).catch((error) => {
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
  }, [motionPreference, storyAction, heroOffset, hideHero]);
  return <div className="scene" aria-hidden="true"><canvas ref={canvas} id="scene" /></div>;
}
