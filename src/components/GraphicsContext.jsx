import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { recommendGraphicsQuality } from '../game/three/quality.js';

const GraphicsContext = createContext({
  renderer: 'auto',
  graphicsQuality: 'balanced',
  backgroundMotion: 'normal',
  unavailable: false,
  recommendedQuality: 'balanced',
  effectiveQuality: 'balanced',
  reportFailure: () => {},
});

export function GraphicsProvider({ settings, children }) {
  const [unavailable, setUnavailable] = useState(false);
  const [recommendedQuality] = useState(() => recommendGraphicsQuality());

  useEffect(() => {
    setUnavailable(false);
  }, [settings.renderer]);

  const reportFailure = useCallback(() => setUnavailable(true), []);
  const effectiveQuality = settings.graphicsQuality;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.dataset.graphicsQuality = effectiveQuality;
    return () => {
      delete document.documentElement.dataset.graphicsQuality;
    };
  }, [effectiveQuality]);

  const value = useMemo(() => ({
    ...settings,
    unavailable,
    recommendedQuality,
    effectiveQuality,
    reportFailure,
  }), [settings, unavailable, recommendedQuality, effectiveQuality, reportFailure]);

  return <GraphicsContext.Provider value={value}>{children}</GraphicsContext.Provider>;
}

export function useGraphics() { return useContext(GraphicsContext); }
