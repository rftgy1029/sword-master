import { useEffect, useRef, useState } from 'react';
import { overheadStatuses, statusGains } from '../game/overhead.js';

// Retain the current indicators during an effect, then reveal changes and gains together.
export function useHeldStatuses(battle, side, busy, includeStreak = false) {
  const next = overheadStatuses(battle, side);
  if (includeStreak && side !== 'enemy' && battle.streak > 0) next.push({ id: 'streak', value: battle.streak });
  const key = next.map(({ id, value }) => `${id}:${value}`).join('|');
  const latest = useRef(next);
  latest.current = next;
  const [shown, setShown] = useState(() => ({ key, list: next, gains: {}, token: 0 }));
  useEffect(() => {
    if (busy) return;
    setShown(previous => previous.key === key ? previous
      : { key, list: latest.current, gains: statusGains(previous.list, latest.current), token: previous.token + 1 });
  }, [busy, key]);
  useEffect(() => {
    if (!Object.keys(shown.gains).length) return undefined;
    const timer = setTimeout(() => setShown(previous => previous.token === shown.token ? { ...previous, gains: {} } : previous), 1600);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}
