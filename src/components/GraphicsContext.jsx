import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const GraphicsContext = createContext({ renderer: 'auto', graphicsQuality: 'auto', backgroundMotion: 'normal', unavailable: false, reportFailure: () => {} });
export function GraphicsProvider({ settings, children }) {
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{setUnavailable(false);},[settings.renderer]);
  const value = useMemo(() => ({ ...settings, unavailable, reportFailure: () => setUnavailable(true) }), [settings, unavailable]);
  return <GraphicsContext.Provider value={value}>{children}</GraphicsContext.Provider>;
}
export function useGraphics() { return useContext(GraphicsContext); }
