import SceneView from './SceneView.jsx';
import LegacyCombatScene from './LegacyCombatScene.jsx';
import {useRef} from 'react';

export default function CombatScene(props) {
  const { enemy,effect,playerDead=false,motionPreference,onBusy,onReady,onImpact }=props;
  const initialEffectId=useRef(effect.id).current;
  return <div className={`combat-scene effect-${effect.kind}`}>
    <SceneView key={enemy.type} mode="battle" initialEffectId={initialEffectId} state={{enemy,effect,playerDead}} callbacks={{onBusy,onReady,onImpact}}
      motionPreference={motionPreference} onFailure={()=>onBusy?.(false)} fallback={<LegacyCombatScene {...props}/>} />
    {effect.amount>0&&!['attack','hurt'].includes(effect.kind)&&<span key={effect.id} className="combat-number" aria-hidden="true">+{effect.amount}</span>}
    <span className="scene-vignette" aria-hidden="true"/>
  </div>;
}
