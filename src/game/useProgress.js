import { useRef, useState } from 'react';
import { emptyProgress, gameReducer } from './engine.js';
import { PROGRESS_KEY, clearProgress, loadProgress, persistProgress } from './storage.js';

export function useProgress({ storageKey = PROGRESS_KEY, reducer = gameReducer } = {}) {
  const [initial] = useState(() => loadProgress(undefined, storageKey));
  const [progress, setProgress] = useState(initial.progress);
  const [error, setError] = useState(initial.error);
  const current = useRef(initial.progress);
  const raw = useRef(initial.raw);
  const blocked = useRef(initial.blocked);
  const conflict = useRef(false);

  function dispatch(action) {
    if (conflict.current) return false;
    const requiresStorage = action.type === 'ADD_WORDBOOK';
    if (requiresStorage && blocked.current) return false;
    const next = reducer(current.current, action);
    if (next === current.current) return false;
    // Save synchronously before the next browser event, rather than an effect
    // after paint. Closing/reloading the quiz cannot refund its consumed card.
    if (!blocked.current) {
      const saved = persistProgress(next, raw.current, undefined, storageKey);
      if (saved.conflict) {
        conflict.current = true;
        setError(saved.error);
        return false;
      }
      if (saved.ok) raw.current = saved.raw;
      setError(saved.error);
      if (!saved.ok && requiresStorage) return false;
    }
    current.current = next;
    setProgress(next);
    return true;
  }

  function resetProgress() {
    clearProgress(undefined, storageKey);
    const fresh = emptyProgress();
    current.current = fresh;
    raw.current = null;
    blocked.current = false;
    conflict.current = false;
    setError('');
    setProgress(fresh);
  }

  return { progress, dispatch, error, resetProgress };
}
