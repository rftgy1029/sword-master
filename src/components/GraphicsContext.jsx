import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { detectDeviceQuality, minQuality, resolveAutoQuality, stepDownQuality } from '../game/three/quality.js';

const GraphicsContext = createContext({
  renderer: 'auto',
  graphicsQuality: 'auto',
  backgroundMotion: 'normal',
  unavailable: false,
  deviceTier: 'balanced',
  autoTier: 'balanced',
  effectiveQuality: 'balanced',
  reportFailure: () => {},
  reportSlowFrame: () => {},
});

export function GraphicsProvider({ settings, children }) {
  const [unavailable, setUnavailable] = useState(false);
  const [deviceTier] = useState(() => detectDeviceQuality());
  const [autoTier, setAutoTier] = useState(deviceTier);
  const [compact, setCompact] = useState(() => (typeof matchMedia === 'function' ? matchMedia('(max-width: 760px)').matches : false));

  useEffect(() => {
    setUnavailable(false);
  }, [settings.renderer]);

  useEffect(() => {
    if (settings.graphicsQuality === 'auto') setAutoTier(deviceTier);
  }, [settings.graphicsQuality, deviceTier]);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const size = matchMedia('(max-width: 760px)');
    const resize = () => setCompact(size.matches);
    size.addEventListener('change', resize);
    return () => size.removeEventListener('change', resize);
  }, []);

  const reportFailure = useCallback(() => setUnavailable(true), []);

  // Performance slowdowns only step down 3D quality within the session and never switch to 2D.
  const reportSlowFrame = useCallback((currentLevel) => {
    setAutoTier((prev) => {
      const target = stepDownQuality(currentLevel || prev);
      return minQuality(prev, target);
    });
  }, []);

  const effectiveQuality = settings.graphicsQuality === 'auto'
    ? resolveAutoQuality({ compact, deviceTier, autoTier })
    : settings.graphicsQuality;

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
    deviceTier,
    autoTier,
    effectiveQuality,
    reportFailure,
    reportSlowFrame,
  }), [settings, unavailable, deviceTier, autoTier, effectiveQuality, reportFailure, reportSlowFrame]);

  return <GraphicsContext.Provider value={value}>{children}</GraphicsContext.Provider>;
}

export function useGraphics() { return useContext(GraphicsContext); }
