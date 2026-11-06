import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const TransitionContext = createContext({ stage: '', mode: 'normal', transition: (commit) => commit() });

export function SceneTransitionProvider({ motionPreference, children }) {
  const [stage, setStage] = useState('');
  const active = useRef(false);
  const timers = useRef(new Set());
  const systemReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mode = motionPreference === 'off' ? 'off' : systemReduced || motionPreference === 'reduced' ? 'reduced' : 'normal';
  const transition = useCallback((commit) => {
    if (active.current) return false;
    if (mode === 'off') { commit(); return true; }
    active.current = true;
    setStage('cover');
    const later = (callback, delay) => {
      const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
      timers.current.add(timer);
    };
    later(() => {
      setStage('covered');
      try { commit(); } finally {
        later(() => setStage('reveal'), mode === 'reduced' ? 20 : 80);
        later(() => {
          active.current = false;
          setStage('');
          const target = document.querySelector('dialog[open] [data-initial-focus]:not(:disabled)') ?? document.querySelector('dialog[open] h2') ?? document.querySelector('.menu-button.is-selected');
          target?.focus({ preventScroll: true });
        }, mode === 'reduced' ? 140 : 380);
      }
    }, mode === 'reduced' ? 100 : 280);
    return true;
  }, [mode]);
  useEffect(() => {
    const blockKeys = (event) => { if (active.current) { event.preventDefault(); event.stopImmediatePropagation(); } };
    document.addEventListener('keydown', blockKeys, true);
    document.addEventListener('pointerdown', blockKeys, true);
    document.addEventListener('click', blockKeys, true);
    const pendingTimers = timers.current;
    return () => {
      document.removeEventListener('keydown', blockKeys, true);
      document.removeEventListener('pointerdown', blockKeys, true);
      document.removeEventListener('click', blockKeys, true);
      pendingTimers.forEach(clearTimeout);
    };
  }, []);
  return <TransitionContext.Provider value={{ stage, mode, transition }}>{children}<TransitionVeil /></TransitionContext.Provider>;
}

export function useSceneTransition() { return useContext(TransitionContext).transition; }

// Native dialogs live in the top layer, so each contains its own synchronized veil.
export function TransitionVeil() {
  const { stage, mode } = useContext(TransitionContext);
  return stage ? <div className={`scene-transition transition-${stage} motion-${mode}`} aria-hidden="true"><i /></div> : null;
}
