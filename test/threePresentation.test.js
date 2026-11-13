import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatPlayback,combatPose,HIT_STOP,impactAges} from '../src/game/three/playback.js';
import {MODEL_TYPES,qualityProfile} from '../src/game/three/quality.js';
import {MONSTERS,CARDS} from '../src/game/catalog.js';
import {ATTACK_HITS} from '../src/game/attackTimeline.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {AnimationMixer} from 'three';

test('all 13 GLBs have complete meshes, materials, matching manifests and usable animation clips',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/models/manifest.json',import.meta.url)));
  assert.deepEqual(new Set(MODEL_TYPES),new Set(['hero',...Object.keys(MONSTERS)]));
  let total=0;
  for(const name of MODEL_TYPES){
    const bytes=readFileSync(new URL(`../public/models/${name}.glb`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    assert.equal(bytes.length,manifest.models[name].bytes);
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    if(manifest.models[name].rig==='skinned armature'){
      // Kenney 팩의 스킨 모델: 몸·머리 메시가 한 뼈대와 색상표 텍스처 하나를 공유한다.
      assert.ok(gltf.skins?.length>=1,'A skinned model carries its skeleton');
      assert.ok(gltf.meshes.length>=2);
      assert.ok(gltf.materials.length>=1);
      assert.ok(gltf.images?.length>=1,'The palette texture is embedded in the GLB');
    }else{
      assert.ok(gltf.meshes.length>=4);
      assert.ok(gltf.materials.length>=3);
    }
    const clips=gltf.animations.map(a=>a.name);
    assert.deepEqual(clips,manifest.models[name].clips);
    assert.ok(clips.includes('idle')&&clips.includes('attack'));
    for(const clip of gltf.animations){assert.ok(clip.channels.length);assert.ok(clip.samplers.length);}
    if(['hero','sentinel'].includes(name))for(const clip of ['walk','hit','guard','victory','death'])assert.ok(clips.includes(clip));
    total+=bytes.length;
  }
  assert.ok(total<12*1024*1024,'All models fit inside the first-scene model budget');
});

test('3D presentation does not replay a restored effect and delivers every hit once across skipped frames',()=>{
  for(const [cardType,hits] of Object.entries(ATTACK_HITS)){
    const busy=[],impacts=[];
    const player=new CombatPlayback({initialEffectId:7,onBusy:x=>busy.push(x),onImpact:i=>impacts.push(i)});
    assert.equal(player.start({id:7,kind:'attack',cardType},'sentinel'),false);
    player.start({id:8,kind:'attack',cardType},'sentinel');
    player.advance(550);player.advance(1000);player.advance(900);
    assert.deepEqual(impacts,hits.map((_,i)=>i));
    assert.deepEqual(busy,[true,false]);
    assert.equal(player.active,null);
    player.advance(10000);player.finish();
    assert.equal(player.start({id:8,kind:'attack',cardType},'sentinel'),false);
    assert.deepEqual(impacts,hits.map((_,i)=>i));
  }
});

test('every enemy animation supports blocked multi-hits and releases the UI after its actual last hit',()=>{
  for(const type of Object.keys(MONSTERS)){
    const hits=[],busy=[];
    const p=new CombatPlayback({onBusy:x=>busy.push(x),onImpact:(i,target)=>hits.push([i,target])});
    p.start({id:1,kind:'hurt',amount:0,impacts:[0,0,0]},type);
    const duration=p.active.duration;
    for(let elapsed=0;elapsed<duration;elapsed+=73){
      const pose=combatPose(p.active);
      assert.ok(Object.values(pose).every(Number.isFinite));
      p.advance(73);
    }
    assert.deepEqual(hits,[[0,'player'],[1,'player'],[2,'player']]);
    assert.deepEqual(busy,[true,false]);
  }
});

test('motion off finishes all supported card effects immediately, while disposal cannot advance game callbacks',()=>{
  for(const cardType of Object.keys(CARDS)){
    const busy=[],hits=[];
    const p=new CombatPlayback({onBusy:x=>busy.push(x),onImpact:i=>hits.push(i)});
    p.start({id:1,kind:CARDS[cardType].damage?'attack':'block',cardType},'boss',true);
    assert.deepEqual(busy,[true,false]);
    assert.equal(p.active,null);
    assert.equal(hits.length,ATTACK_HITS[cardType]?.length??0);
  }
  const busy=[];const p=new CombatPlayback({onBusy:x=>busy.push(x)});
  p.start({id:1,kind:'hurt',impacts:[10]},'boss');p.dispose();p.advance(5000);p.finish();
  assert.deepEqual(busy,[true]);
});

test('graphics quality caps resolution, particles and shadows for compact screens',()=>{
  const low=qualityProfile('auto',{compact:true,pixelRatio:3});
  assert.equal(low.dpr,1);assert.equal(low.shadows,false);assert.equal(low.fps,30);
  assert.ok(qualityProfile('high',{pixelRatio:3}).dpr<=2);
  assert.ok(low.particles<qualityProfile('high').particles);
});

test('enemy block, buff, charge and wait have their own presentation without inventing damage',()=>{
  for(const enemyAction of ['block','buff','charge','wait']){
    const hits=[],busy=[];const p=new CombatPlayback({onImpact:i=>hits.push(i),onBusy:value=>busy.push(value)});
    p.start({id:1,kind:'enemy',enemyAction,amount:0},'watcher');
    assert.ok(Number.isFinite(p.active.plan.color));
    p.advance(1000);assert.deepEqual(hits,[]);assert.deepEqual(busy,[true,false]);
  }
});

test('melee contact reaches the enemy at every hit, while ranged skills keep the hero at home',()=>{
  for(const type of ['strike','heavy','twin'])for(const at of ATTACK_HITS[type]){
    const p=new CombatPlayback();p.start({id:1,kind:'attack',cardType:type},'sentinel');p.advance(at);
    const pose=combatPose(p.active);assert.ok(pose.enemyX-pose.heroX<=1.8,`${type} reaches weapon range`);
  }
  for(const type of ['flare','nova']){
    const p=new CombatPlayback();p.start({id:1,kind:'attack',cardType:type},'sentinel');p.advance(1000);
    assert.ok(combatPose(p.active).heroX<-2);
  }
});

// Node에는 이미지 디코더가 없어 GLTFLoader가 내장 텍스처에서 멈춘다. 관절과 동작만 검사하므로 텍스처 참조를 떼어 낸다.
function withoutTextures(glb){
  const length=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+length).toString());
  delete gltf.images;delete gltf.textures;delete gltf.samplers;
  for(const material of gltf.materials??[])delete material.pbrMetallicRoughness?.baseColorTexture;
  let json=Buffer.from(JSON.stringify(gltf));
  json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const rest=glb.subarray(20+length),head=Buffer.alloc(20);
  head.write('glTF',0);head.writeUInt32LE(2,4);head.writeUInt32LE(20+json.length+rest.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4E4F534A,16);
  return Buffer.concat([head,json,rest]);
}

test('exported hero animation changes the sword joint between anticipation and contact',async()=>{
  const bytes=withoutTextures(readFileSync(new URL('../public/models/hero.glb',import.meta.url)));
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const model=await new GLTFLoader().parseAsync(buffer,'');
  const arm=model.scene.getObjectByName('arm_right');assert.ok(arm);
  const clip=model.animations.find(clip=>clip.name==='attack');
  const mixer=new AnimationMixer(model.scene);mixer.clipAction(clip).play();
  mixer.setTime(clip.duration*.28);const prepare=arm.quaternion.clone();
  mixer.setTime(clip.duration*.52);const impact=arm.quaternion.clone();
  assert.ok(Math.abs(prepare.dot(impact))<.98,'The weapon changes direction into the contact pose');
  mixer.stopAllAction();mixer.uncacheRoot(model.scene);
});

test('Kenney dungeon kit contains every piece the scenes place, and the manifest matches the GLB',async()=>{
  const {dungeonLayout,groupByPiece,COMPOSITE_PIECES}=await import('../src/game/three/kenneyDungeon.js');
  const manifest=JSON.parse(readFileSync(new URL('../public/models/manifest.json',import.meta.url)));
  const bytes=readFileSync(new URL('../public/models/dungeon-kit.glb',import.meta.url));
  assert.equal(bytes.length,manifest.dungeon.bytes);
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const nodes=new Map(gltf.nodes.map(node=>[node.name,node]));
  assert.equal(gltf.materials.length,1,'All pieces share one palette material');
  assert.equal(gltf.images?.length,1,'The palette texture is embedded once');
  for(const variant of ['hall','library','forge'])for(const mode of ['battle','title','entry','reward','rest','forge','result']){
    const layout=dungeonLayout(variant,mode);
    assert.ok(layout.some(item=>item.piece==='wall-opening'),'The back wall keeps its doorway');
    for(const [piece,items] of groupByPiece(layout)){
      const node=nodes.get(piece);
      assert.ok(node,`${piece} exists in dungeon-kit.glb`);
      assert.ok(COMPOSITE_PIECES.includes(piece)||node.mesh!==undefined,`${piece} can be drawn as one instanced mesh`);
      for(const item of items)assert.ok(item.position.every(Number.isFinite)&&item.scale>0);
    }
  }
  assert.deepEqual(dungeonLayout('hall','battle'),dungeonLayout('hall','battle'),'The same scene always gets the same layout');
});

test('player hits pause the timeline briefly (hit-stop) while impact ages keep running on the real clock',()=>{
  const p=new CombatPlayback();p.start({id:1,kind:'attack',cardType:'strike'},'sentinel');
  p.advance(ATTACK_HITS.strike[0]);
  assert.equal(p.active.elapsed,ATTACK_HITS.strike[0]);
  p.advance(HIT_STOP.strike/2);
  assert.equal(p.active.elapsed,ATTACK_HITS.strike[0],'the swing is frozen on contact');
  assert.equal(impactAges(p.active)[0],HIT_STOP.strike/2,'effects keep animating during the freeze');
  p.advance(HIT_STOP.strike/2+100);
  assert.equal(p.active.elapsed,ATTACK_HITS.strike[0]+100);
  const enemy=new CombatPlayback();enemy.start({id:1,kind:'hurt',impacts:[3]},'boss');
  enemy.advance(enemy.active.hits[0]+50);
  assert.equal(enemy.active.elapsed,enemy.active.hits[0]+50,'monster hits do not freeze the timeline');
});
