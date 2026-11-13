import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useGraphics } from './GraphicsContext.jsx';
import { heroImage } from '../game/spriteAssets.js';

const ThreeStage = lazy(() => import('../game/three/ThreeStage.jsx'));

class SceneBoundary extends Component {
  state = { failed:false };
  static getDerivedStateFromError() { return { failed:true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function PaintedFallback({ mode }) {
  return <div className={`painted-scene painted-${mode}`}><div className="painted-arch" /><img src={heroImage} alt="" /><i /><i /></div>;
}

function SceneChoice({ mode='battle', fallback, onFailure, onLoaded, motionPreference, className='', active=true, ...props }) {
  const graphics=useGraphics();
  const [failed,setFailed]=useState(false), [ready,setReady]=useState(false);
  const reported=useRef(false);
  const latest=useRef({onFailure,onLoaded,graphics}); latest.current={onFailure,onLoaded,graphics};
  const loaded=useCallback(()=>{setReady(true);latest.current.onLoaded?.();},[]);
  const fail=useCallback(()=>{
    if(reported.current)return;
    reported.current=true;
    setFailed(true);latest.current.onFailure?.();latest.current.graphics.reportFailure();
  },[]);
  const use3d=graphics.renderer!=='2d' && !graphics.unavailable && !failed;
  useEffect(()=>{
    if(!active||!use3d||ready)return;
    const timer=setTimeout(fail,15000);
    return()=>clearTimeout(timer);
  },[active,use3d,ready,fail]);
  if(!active)return <div className={`scene-view ${className}`} />;
  if(!use3d)return <div className={`scene-view ${className}`} data-renderer="2d">{fallback ?? <PaintedFallback mode={mode}/>}</div>;
  return <div className={`scene-view scene-${mode} ${className}`} data-renderer="3d" aria-busy={!ready}>
    <SceneBoundary onFailure={fail}>
      <Suspense fallback={<div className="scene-loading" role="status"><span/>석문이 열린다…</div>}>
        <ThreeStage {...props} mode={mode} graphicsQuality={graphics.graphicsQuality} motionPreference={motionPreference ?? graphics.backgroundMotion} onFailure={fail} onLoaded={loaded} />
      </Suspense>
    </SceneBoundary>
    {!ready&&<div className="scene-loading" role="status"><span/>석문이 열린다…</div>}
  </div>;
}

export default function SceneView(props) {
  const graphics=useGraphics();
  return <SceneChoice key={graphics.renderer} {...props}/>;
}
