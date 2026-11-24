import {
  Component,
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { lighterQuality } from '../game/three/quality.js';

const ThreeStage = lazy(() => import('../game/three/ThreeStage.jsx'));

const PARKING_STYLE = Object.freeze({
  position: 'fixed',
  width: 2,
  height: 2,
  overflow: 'hidden',
  opacity: 0,
  pointerEvents: 'none',
  left: -9999,
  top: -9999,
});

const SharedStageContext = createContext(null);

class StageErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function SharedStageRenderer({
  store,
  hostEl,
  parkingRef,
  allow3d,
  warmupStatus,
  settings,
  boundaryKey,
  onWarmupReady,
  onLoaded,
  onFailure,
  onPerfSuggest,
}) {
  const [, setRevision] = useState(0);
  const renderedVersion = store.version;
  const topClaim = store.top();

  useLayoutEffect(() => {
    const onStore = () => setRevision((r) => r + 1);
    store.listeners.add(onStore);
    if (store.version !== renderedVersion) setRevision((r) => r + 1);
    return () => { store.listeners.delete(onStore); };
  }, [store, renderedVersion]);

  const shouldMount = allow3d && (warmupStatus === 'warming' || warmupStatus === 'ready' || Boolean(topClaim));
  const parked = !topClaim && warmupStatus !== 'warming';
  const warmupMode = !topClaim && warmupStatus === 'warming';

  useLayoutEffect(() => {
    if (!hostEl) return;
    const target = topClaim?.slotEl?.isConnected ? topClaim.slotEl : parkingRef.current;
    if (target && hostEl.parentNode !== target) {
      target.appendChild(hostEl);
    }
  }, [hostEl, parkingRef, topClaim, shouldMount]);

  if (!shouldMount || !hostEl) return null;

  return createPortal(
    <StageErrorBoundary key={boundaryKey} onFailure={onFailure}>
      <Suspense fallback={null}>
        <ThreeStage
          {...(topClaim?.props ?? {})}
          graphicsQuality={settings.graphicsQuality}
          motionPreference={topClaim?.props?.motionPreference ?? settings.backgroundMotion}
          parked={parked}
          warmupMode={warmupMode}
          sceneInstanceId={topClaim?.id ?? 0}
          onWarmupReady={onWarmupReady}
          onLoaded={onLoaded}
          onFailure={onFailure}
          onPerfSuggest={onPerfSuggest}
        />
      </Suspense>
    </StageErrorBoundary>,
    hostEl,
  );
}

export function SharedStageProvider({ settings, unavailable = false, reportFailure, children }) {
  const allow3d = settings.renderer !== '2d' && !unavailable;
  const allow3dRef = useRef(allow3d);
  allow3dRef.current = allow3d;

  const [warmupStatus, setWarmupStatus] = useState(() => (allow3d ? 'idle' : 'skipped'));
  const [perfSuggestion, setPerfSuggestion] = useState(null);
  const parkingRef = useRef(null);

  const hostEl = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = 'shared-three-host';
    el.style.width = '100%';
    el.style.height = '100%';
    return el;
  }, []);

  useEffect(() => () => {
    hostEl?.remove();
  }, [hostEl]);

  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = {
      nextId: 1,
      version: 0,
      claims: [],
      listeners: new Set(),
      notify() {
        this.version += 1;
        for (const listener of this.listeners) listener();
      },
      top() {
        return this.claims[this.claims.length - 1] ?? null;
      },
    };
  }

  useEffect(() => {
    if (!allow3d) {
      setWarmupStatus('skipped');
    } else {
      setWarmupStatus((prev) => (prev === 'skipped' ? 'idle' : prev));
    }
  }, [allow3d]);

  useEffect(() => {
    setPerfSuggestion(null);
  }, [settings.graphicsQuality]);

  const requestWarmup = useCallback(() => {
    if (!allow3dRef.current) {
      setWarmupStatus('skipped');
      return;
    }
    setWarmupStatus((prev) => (prev === 'ready' || prev === 'warming' ? prev : 'warming'));
  }, []);

  const handleWarmupReady = useCallback(() => {
    setWarmupStatus((prev) => (allow3dRef.current ? 'ready' : prev));
  }, []);

  const dismissPerfSuggestion = useCallback(() => {
    setPerfSuggestion(null);
  }, []);

  const handlePerfSuggest = useCallback((level) => {
    const suggested = lighterQuality(level);
    if (!suggested) return;
    setPerfSuggestion((prev) => (prev ?? { currentQuality: level, suggestedQuality: suggested }));
  }, []);

  const handleSceneLoaded = useCallback((readySceneId) => {
    setWarmupStatus((prev) => (prev === 'warming' && allow3dRef.current ? 'ready' : prev));
    const claim = storeRef.current.claims.find((entry) => entry.id === readySceneId);
    claim?.onReady?.();
  }, []);

  const handleStageFailure = useCallback(() => {
    const top = storeRef.current.top();
    top?.onFailure?.();
    reportFailure?.();
    setWarmupStatus('skipped');
  }, [reportFailure]);

  const claimActions = useMemo(() => ({
    claim({ slotEl, props, onReady, onFailure }) {
      const store = storeRef.current;
      const id = store.nextId++;
      store.claims.push({ id, slotEl, props, onReady, onFailure });
      if (hostEl && slotEl && hostEl.parentNode !== slotEl) {
        slotEl.appendChild(hostEl);
      }
      store.notify();
      return id;
    },
    update(id, { slotEl, props, onReady, onFailure }) {
      const store = storeRef.current;
      const entry = store.claims.find((item) => item.id === id);
      if (!entry) return;
      entry.slotEl = slotEl;
      entry.props = props;
      entry.onReady = onReady;
      entry.onFailure = onFailure;
      if (store.top()?.id === id) {
        if (hostEl && slotEl && hostEl.parentNode !== slotEl) {
          slotEl.appendChild(hostEl);
        }
        store.notify();
      }
    },
    release(id) {
      const store = storeRef.current;
      const index = store.claims.findIndex((item) => item.id === id);
      if (index === -1) return;
      store.claims.splice(index, 1);
      const next = store.top();
      const target = next?.slotEl?.isConnected ? next.slotEl : parkingRef.current;
      if (hostEl && target && hostEl.parentNode !== target) {
        target.appendChild(hostEl);
      }
      store.notify();
    },
  }), [hostEl]);

  const stageInfo = useMemo(() => ({
    warmupStatus,
    requestWarmup,
    perfSuggestion,
    dismissPerfSuggestion,
  }), [warmupStatus, requestWarmup, perfSuggestion, dismissPerfSuggestion]);

  return (
    <SharedStageContext.Provider value={claimActions}>
      {typeof children === 'function' ? children(stageInfo) : children}
      <div ref={parkingRef} className="shared-three-parking" aria-hidden="true" style={PARKING_STYLE} />
      <SharedStageRenderer
        store={storeRef.current}
        hostEl={hostEl}
        parkingRef={parkingRef}
        allow3d={allow3d}
        warmupStatus={warmupStatus}
        settings={settings}
        boundaryKey={`${settings.renderer}:${unavailable}`}
        onWarmupReady={handleWarmupReady}
        onLoaded={handleSceneLoaded}
        onFailure={handleStageFailure}
        onPerfSuggest={handlePerfSuggest}
      />
    </SharedStageContext.Provider>
  );
}

export function useSharedStage() {
  return useContext(SharedStageContext);
}
