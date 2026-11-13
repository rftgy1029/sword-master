import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {GraphicsProvider} from '../src/components/GraphicsContext.jsx';
import CombatScene from '../src/components/CombatScene.jsx';
import {MONSTERS,CARDS} from '../src/game/catalog.js';
import {ATTACK_HITS} from '../src/game/attackTimeline.js';
import {DEFAULT_SETTINGS} from '../src/settings.js';
import '../styles.css';
import '../src/components/adventure.css';
import '../src/styles/premium.css';

function Preview(){
  const [type,setType]=useState('sentinel'),[settings,setSettings]=useState(DEFAULT_SETTINGS);
  const [effect,setEffect]=useState({id:0,kind:'start',amount:0});
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[fatal,setFatal]=useState(false);
  const [upgraded,setUpgraded]=useState(false);
  const [hits,setHits]=useState([]),[status,setStatus]=useState('장면 준비 중');
  const controller=useRef(null),counter=useRef(0);
  const enemy={type,hp:1000};
  const changeType=event=>{setReady(false);setBusy(false);setFatal(false);setHits([]);setType(event.target.value);setStatus('장면 준비 중');};
  const play=(cardType)=>{
    setHits([]);setFatal(false);const card=CARDS[cardType];
    setEffect({id:++counter.current,kind:card.damage?'attack':card.heal?'heal':'block',cardType,upgraded,amount:card.damage??card.heal??card.block??3,impacts:ATTACK_HITS[cardType]?.map(()=>4)});
  };
  const callbacks={onReady:()=>{setReady(true);setStatus('장면 준비 완료');},onBusy:value=>{setBusy(value);if(!value)setStatus('연출 완료');},onImpact:(index,target)=>setHits(list=>[...list,`${target??'enemy'}:${index}`])};
  return <GraphicsProvider settings={settings}><main className="three-preview-page" style={{maxWidth:1280,margin:'auto',padding:24}}>
    <h1 style={{fontSize:32,lineHeight:1.4}}>S’word Master · 3D 장면 검증</h1>
    <p>실제 학습·모험 저장을 사용하지 않는 장면입니다.</p>
    <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBlock:18}}>
      <label>몬스터 <select aria-label="몬스터" value={type} onChange={changeType}>{Object.entries(MONSTERS).map(([id,m])=><option key={id} value={id}>{m.name}</option>)}</select></label>
      <label>품질 <select aria-label="품질" value={settings.graphicsQuality} onChange={e=>setSettings({...settings,graphicsQuality:e.target.value})}>{['auto','low','balanced','high'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>움직임 <select aria-label="움직임" value={settings.backgroundMotion} onChange={e=>setSettings({...settings,backgroundMotion:e.target.value})}>{['normal','reduced','off'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>화면 <select aria-label="화면" value={settings.renderer} onChange={e=>setSettings({...settings,renderer:e.target.value})}>{['auto','3d','2d'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label><input type="checkbox" checked={upgraded} onChange={e=>setUpgraded(e.target.checked)}/>강화 카드</label>
      <button className="game-secondary" disabled={!ready||busy} onClick={()=>{setHits([]);setFatal(false);setEffect({id:++counter.current,kind:'hurt',amount:12,impacts:[4,4,4]});}}>몬스터 다단 공격</button>
      <button className="game-secondary" disabled={!ready||busy} onClick={()=>{setHits([]);setFatal(true);setEffect({id:++counter.current,kind:'hurt',amount:12,impacts:[4,4,4]});}}>치명타</button>
      <button className="game-secondary" onClick={()=>controller.current?.rotate(.6)}>카메라 회전</button>
      <button className="game-secondary" onClick={()=>controller.current?.advance(2500)}>연출 끝까지</button>
    </div>
    <output id="scene-status" style={{display:'block',padding:12,color:'#efd69b'}}>{status}</output>
    <output id="hit-status">{hits.join(',')}</output>
    <div className="preview-arena" style={{position:'relative',height:480,border:'1px solid #738455',borderRadius:16,overflow:'hidden',marginBlock:16}}>
      <CombatScene key={type} enemy={enemy} effect={effect} playerDead={fatal} motionPreference={settings.backgroundMotion} onController={value=>{controller.current=value;}} {...callbacks}/>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.entries(CARDS).map(([id,card])=><button key={id} className="game-secondary" disabled={!ready||busy} data-card-type={id} onClick={()=>play(id)}>{card.name}</button>)}</div>
    <a style={{display:'inline-block',marginTop:20,color:'#e0c690'}} href="../">게임으로 돌아가기</a>
  </main></GraphicsProvider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
