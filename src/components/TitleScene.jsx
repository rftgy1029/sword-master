import { useEffect, useRef, useState } from 'react';
import entrancePreview from '../../assets/maps/dungeon-entrance-preview.png';

export default function TitleScene({ motionPreference = 'normal' }) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const syncVisibility = () => document.documentElement.classList.toggle('paused', document.hidden);
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      document.documentElement.classList.remove('paused');
    };
  }, []);

  return <div className="scene">
    <img className="scene-preview" src={entrancePreview} width="384" height="288" alt="" />
    <TitleAnimation key={`${motionPreference}:${attempt}`} motionPreference={motionPreference}
      onRetry={() => setAttempt((previous) => previous + 1)} />
  </div>;
}

function TitleAnimation({ motionPreference, onRetry }) {
  const canvas = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let moduleLoaded = false;
    const timeout = setTimeout(() => fail(new Error('던전 입구 로딩 시간 초과')), 20_000);

    function fail(error) {
      if (signal.aborted) return;
      clearTimeout(timeout);
      controller.abort();
      console.warn('던전 입구 애니메이션을 불러오지 못했습니다.', error);
      setStatus(moduleLoaded ? 'failed' : 'reload');
    }

    async function load() {
      try {
        const { startPhaserTitleScene } = await import('../game/titleScene.js');
        if (signal.aborted) return;
        moduleLoaded = true;
        startPhaserTitleScene(canvas.current, {
          signal,
          motionPreference,
          onReady: () => {
            if (signal.aborted) return;
            clearTimeout(timeout);
            setStatus('ready');
          },
          onError: fail,
        });
      } catch (error) {
        fail(error);
      }
    }

    load();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [motionPreference]);

  return <>
    <canvas ref={canvas} id="scene" width="384" height="288" aria-hidden="true" hidden={status !== 'ready'} />
    <div className="scene-feedback" hidden={status === 'ready'}>
      <span role="status">{status === 'loading' ? '던전 입구를 불러오는 중…' : '던전 애니메이션을 불러오지 못했어요.'}</span>
      {status === 'failed' && <button type="button" onClick={onRetry}>다시 시도</button>}
      {status === 'reload' && <button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button>}
    </div>
  </>;
}
