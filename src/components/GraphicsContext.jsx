import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { recommendGraphicsQuality } from '../game/three/quality.js';
import { SharedStageProvider } from './SharedStageContext.jsx';

const GraphicsContext = createContext({
  renderer: 'auto',
  graphicsQuality: 'balanced',
  backgroundMotion: 'normal',
  unavailable: false,
  recommendedQuality: 'balanced',
  effectiveQuality: 'balanced',
  reportFailure: () => {},
  warmupStatus: 'idle',
  requestWarmup: () => {},
  perfSuggestion: null,
  dismissPerfSuggestion: () => {},
});

function GraphicsContextBridge({ baseValue, stageInfo, children }) {
  const value = useMemo(() => ({
    ...baseValue,
    ...stageInfo,
  }), [baseValue, stageInfo]);
  return <GraphicsContext.Provider value={value}>{children}</GraphicsContext.Provider>;
}

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

  const baseValue = useMemo(() => ({
    ...settings,
    unavailable,
    recommendedQuality,
    effectiveQuality,
    reportFailure,
  }), [settings, unavailable, recommendedQuality, effectiveQuality, reportFailure]);

  return (
    <SharedStageProvider settings={settings} unavailable={unavailable} reportFailure={reportFailure}>
      {(stageInfo) => (
        <GraphicsContextBridge baseValue={baseValue} stageInfo={stageInfo}>
          {children}
        </GraphicsContextBridge>
      )}
    </SharedStageProvider>
  );
}

export function useGraphics() { return useContext(GraphicsContext); }
