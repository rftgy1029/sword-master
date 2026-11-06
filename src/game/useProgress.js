import { useRef, useState } from 'react';
import { gameReducer } from './engine.js';
import { loadProgress, persistProgress } from './storage.js';

export function useProgress() {
  const [initial] = useState(loadProgress);
  const [progress, setProgress] = useState(initial.progress);
  const [error, setError] = useState(initial.error);
  const current = useRef(initial.progress);
  const raw = useRef(initial.raw);
  const conflict = useRef(false);

  function dispatch(action) {
    if (conflict.current) return false;
    const next = gameReducer(current.current, action);
    if (next === current.current) return false;
    // Save synchronously before the next browser event, rather than an effect
    // after paint. Closing/reloading the quiz cannot refund its consumed card.
    if (!initial.blocked) {
      const saved = persistProgress(next, raw.current);
      if (saved.conflict) {
        conflict.current = true;
        setError(saved.error);
        return false;
      }
      if (saved.ok) raw.current = saved.raw;
      setError(saved.error);
    }
    current.current = next;
    setProgress(next);
    return true;
  }
  return { progress, dispatch, error };
}
