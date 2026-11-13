import SceneView from './SceneView.jsx';
import LegacyCombatScene from './LegacyCombatScene.jsx';
import {useEffect,useRef,useState} from 'react';

export default function CombatScene(props) {
  const { enemy,effect,playerDead=false,motionPreference,onBusy,onReady,onImpact }=props;
  const initialEffectId=useRef(effect.id).current;
  // 타격마다 뜨는 피해 숫자. 연출 시점(onImpact)에 맞춰 하나씩 튀어 오른다.
  const [hits,setHits]=useState([]);
  const latestEffect=useRef(effect);latestEffect.current=effect;
  const timers=useRef(new Set());
  useEffect(()=>()=>{timers.current.forEach(clearTimeout);},[]);
  const impact=(index,target)=>{
    onImpact?.(index,target);
    const current=latestEffect.current;
    const amount=current.impacts?.[index]??current.amount;
    if(!(amount>0)||!['attack','hurt'].includes(current.kind))return;
    const id=`${current.id}-${index}`;
    setHits(list=>[...list.filter(hit=>hit.id!==id),{id,amount,index,player:target==='player',heavy:['heavy','nova'].includes(current.cardType)}]);
    const timer=setTimeout(()=>{timers.current.delete(timer);setHits(list=>list.filter(hit=>hit.id!==id));},950);
    timers.current.add(timer);
  };
  return <div className={`combat-scene effect-${effect.kind}`}>
    <SceneView key={enemy.type} mode="battle" initialEffectId={initialEffectId} state={{enemy,effect,playerDead}} callbacks={{onBusy,onReady,onImpact:impact}}
      motionPreference={motionPreference} onFailure={()=>onBusy?.(false)} fallback={<LegacyCombatScene {...props}/>} />
    {effect.amount>0&&!['attack','hurt'].includes(effect.kind)&&<span key={effect.id} className="combat-number" aria-hidden="true">+{effect.amount}</span>}
    {hits.map(hit=><span key={hit.id} className={`combat-hit-number${hit.player?' is-player':''}${hit.heavy?' is-heavy':''}`}
      style={{'--hit-x':`${(hit.index%2?1:-1)*(hit.index?28:0)}px`,'--hit-y':`${-hit.index*18}px`}} aria-hidden="true">{hit.amount}</span>)}
    <span className="scene-vignette" aria-hidden="true"/>
  </div>;
}
