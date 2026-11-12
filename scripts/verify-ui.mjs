import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const artifactRoot=fileURLToPath(new URL('../artifacts/',import.meta.url));
mkdirSync(artifactRoot,{recursive:true});
const BASE_URL=process.env.BROWSER_BASE_URL??'http://127.0.0.1:8175/';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {emptyProgress,gameReducer,reachableNodes,intentFor} from '../src/game/engine.js';
import {questionById} from '../src/game/quiz.js';
import {CARDS,cardDetails} from '../src/game/catalog.js';

function forgeFixture(){
  let p=gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:17});
  for(let step=0;step<500;step++){
    const r=p.run,b=r.battle;let action;
    if(r.phase==='forge')return p;
    if(r.phase==='map'){
      const order={forge:100,rest:10,treasure:9,battle:5,elite:0,boss:1};
      action={type:'SELECT_NODE',id:reachableNodes(r).sort((a,b)=>order[b.type]-order[a.type])[0].id};
    }else if(r.phase==='rest')action={type:'REST'};
    else if(r.phase==='reward')action=!r.reward.cardTaken?{type:'SKIP_CARD'}:!r.reward.relicTaken?{type:'TAKE_RELIC'}:{type:'LEAVE_REWARD'};
    else if(r.phase==='result')throw new Error('Forge fixture reached result unexpectedly');
    else if(b.feedback)action={type:'ACK'};
    else if(b.pending){const q=b.pending.question;action={type:'ANSWER',id:q.id,answer:q.options.find(s=>questionById(q.id).answers.includes(s))};}
    else{
      const cards=b.hand.map(uid=>r.deck.find(c=>c.uid===uid)).filter(c=>CARDS[c.type].cost<=b.energy);
      const intent=intentFor(b.enemy);
      const score=card=>{const c=cardDetails(card);if(c.heal)return r.hp<r.maxHp-7?100:-1;if(c.focus)return cards.some(other=>other.uid!==card.uid&&cardDetails(other).damage)?90:-1;if(c.strength)return b.turn<4?50:1;if(c.block&&!c.damage)return intent.kind==='attack'&&b.block<intent.value?40:0;if(c.weak)return intent.value>=10&&b.enemy.weak<1?30:0;return(c.damage+b.strength+b.focus)*(c.hits||1)/(c.cost||1)+10;};
      cards.sort((a,b)=>score(b)-score(a));action=cards.length&&score(cards[0])>0?{type:'SELECT_CARD',uid:cards[0].uid}:{type:'END_TURN'};
    }
    p=gameReducer(p,action);
  }
  throw new Error('Forge fixture did not complete');
}

let fixture=gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:42});
fixture=gameReducer(fixture,{type:'SELECT_NODE',id:reachableNodes(fixture.run)[0].id});
fixture=gameReducer(fixture,{type:'SELECT_CARD',uid:fixture.run.battle.hand[0]});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true});
await context.addInitScript(f=>{
  localStorage.setItem('sword-master.adventure.v1',JSON.stringify({version:1,progress:f}));
  localStorage.setItem('sword-master.settings.v1',JSON.stringify({version:1,settings:{textSize:'larger',backgroundMotion:'off',selectionEffect:'static',renderer:'3d',graphicsQuality:'low'}}));
},fixture);
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
const shot=name=>page.screenshot({path:`${artifactRoot}3d-${name}.png`});
try{
  await page.goto(BASE_URL);
  await page.getByRole('button',{name:/^이어하기/}).click();
  await page.locator('.quiz-options button:not(:disabled)').nth(3).waitFor({timeout:20000});
  await page.locator('.quiz-options button').nth(3).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.quiz-options').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),1);
  assert.ok(await page.locator('.quiz-options').evaluate(node=>node.clientWidth>=node.parentElement.clientWidth-40),'Mobile choices use the panel width');
  await shot('quiz-mobile-large');
  const q=fixture.run.battle.pending.question;
  const wrong=q.options.findIndex(s=>!questionById(q.id).answers.includes(s));
  await page.locator('.quiz-options button').nth(wrong).tap();
  await page.locator('.quiz-feedback .game-primary:not(:disabled)').waitFor({timeout:20000});
  const p=await read();assert.equal(p.run.battle.enemy.hp,fixture.run.battle.enemy.hp);assert.equal(p.learning.entries[q.id].wrong,1);
  await page.locator('.quiz-feedback .game-primary').click();
  await page.getByRole('button',{name:'모험 닫고 타이틀로',exact:true}).click();
  console.log('360px / max text: options reachable, wrong answer records learning without damage');
  await page.setViewportSize({width:1366,height:768});
  await page.getByRole('button',{name:'오답 복습',exact:false}).click();
  for(let i=0;i<2;i++){
    await page.locator('.weakness-list button').first().click();
    const current=await read(),rq=current.review.question;
    const correct=rq.options.findIndex(s=>questionById(rq.id).answers.includes(s));
    await page.locator('.quiz-options button').nth(correct).click();
    await page.locator('.quiz-feedback .game-primary').click();
  }
  assert.equal((await read()).learning.entries[q.id].active,false);
  await shot('review');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement?.textContent.includes('오답 복습'));
  console.log('weakness review: two correct answers complete; Escape restores menu focus');
  await page.getByRole('button',{name:'단어장',exact:false}).click();
  const term=await page.locator('.word-entry .word-term').first().textContent();
  await page.getByRole('searchbox').fill(term);
  await page.locator('.word-entry summary').first().click();
  await shot('vocabulary');
  await page.getByRole('button',{name:'단어장 닫기',exact:true}).click();
  const before=await read();
  await page.getByRole('button',{name:'설정',exact:false}).click();
  await page.getByRole('radio',{name:'간편 화면',exact:true}).check();
  await shot('settings');
  await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
  await page.locator('.scene-view[data-renderer="2d"] canvas:not([hidden])').waitFor();
  assert.deepEqual(await read(),before);
  await page.getByRole('button',{name:'설정',exact:false}).click();
  await page.getByRole('radio',{name:'입체 화면',exact:true}).check();
  await page.getByRole('radio',{name:'보통',exact:true}).first().check();
  await page.getByRole('button',{name:'설정 닫기',exact:true}).click();
  await page.locator('.scene-view[data-renderer="3d"][aria-busy="false"]').waitFor({timeout:20000});
  await page.setViewportSize({width:360,height:740});await shot('title-mobile');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('settings: 2D -> 3D retries and reading preferences preserve all progress');
  for(const kind of ['map','forge']){
    const progress=kind==='forge'?forgeFixture():gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:42});
    const other=await browser.newContext({viewport:{width:1366,height:768}});
    await other.addInitScript(p=>{
      localStorage.setItem('sword-master.adventure.v1',JSON.stringify({version:1,progress:p}));
      localStorage.setItem('sword-master.settings.v1',JSON.stringify({version:1,settings:{textSize:'normal',backgroundMotion:'off',selectionEffect:'static',renderer:'3d',graphicsQuality:'low'}}));
    },progress);
    const view=await other.newPage();view.on('pageerror',e=>errors.push(e.message));
    await view.goto(BASE_URL);await view.getByRole('button',{name:/^이어하기/}).click();
    if(kind==='map'){
      await view.locator('.map-overview .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      const visible=await view.locator('.map-overview canvas').evaluate(canvas=>{
        const api=canvas.__sword3d,group=api.scene.getObjectByName('route-map'),rect=canvas.getBoundingClientRect();
        const nodes=JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress.run.map.flat();
        return nodes.every(node=>[-.94,.94].every(dx=>[-.4,1.15].every(y=>[-.65,.65].every(dz=>{
          const p=group.position.clone().set((node.lane-1)*3+dx,y,-(node.floor-3.5)*1.55+dz);
          group.localToWorld(p);const point=api.project(p.toArray());
          return point.x>=rect.left&&point.x<=rect.right&&point.y>=rect.top&&point.y<=rect.bottom;
        }))));
      });
      assert.equal(visible,true,'All dungeon rooms fit inside the 3D overview');
      await view.screenshot({path:`${artifactRoot}3d-map.png`});
      const point=await view.locator('.map-overview canvas').evaluate(canvas=>{
        const api=canvas.__sword3d,group=api.scene.getObjectByName('route-map');
        const local=group.position.clone().set(0,.35,5.425);group.localToWorld(local);return api.project(local.toArray());
      });
      await view.mouse.click(point.x,point.y);
      await view.locator('.battle-screen').waitFor();
      const saved=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
      assert.equal(saved.run.floor,0);assert.equal(saved.run.phase,'battle');
      console.log('3D room raycast selects the real dungeon node');
    }else{
      await view.locator('.location-scene .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      const oldGold=progress.run.gold;
      await view.locator('.upgrade-list .upgrade-item:not(:disabled)').first().click();
      let saved=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
      assert.equal(saved.run.gold,oldGold-30);assert.ok(saved.run.deck.some(card=>card.upgraded));
      await view.getByRole('button',{name:/^유물 강화/}).click();
      const relic=view.locator('.relic-item button').first();
      if(saved.run.gold>=45){await relic.click();const next=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);assert.equal(next.run.gold,saved.run.gold-45);saved=next;}
      else assert.equal(await relic.isDisabled(),true);
      await view.getByRole('button',{name:/^카드 구입/}).click();
      const stock=view.locator('.reward-cards button');
      if(saved.run.gold>=35){await stock.first().click();const next=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);assert.equal(next.run.gold,saved.run.gold-35);}
      else for(const button of await stock.all())assert.equal(await button.isDisabled(),true);
      await view.screenshot({path:`${artifactRoot}3d-forge.png`});
      console.log('3D forge: card upgrade, relic upgrade and shop follow real gold costs');
    }
    await other.close();
  }
  let defeat;
  for(let seed=1;seed<=100;seed++){
    let p=gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed});
    p=gameReducer(p,{type:'SELECT_NODE',id:reachableNodes(p.run)[0].id});
    if(intentFor(p.run.battle.enemy).kind==='attack'){defeat=p;break;}
  }
  assert.ok(defeat,'A first-turn enemy attack is available for the defeat fixture');
  defeat.run.hp=1;
  const last=await browser.newContext({viewport:{width:1366,height:768}});
  await last.addInitScript(p=>{
    localStorage.setItem('sword-master.adventure.v1',JSON.stringify({version:1,progress:p}));
    localStorage.setItem('sword-master.settings.v1',JSON.stringify({version:1,settings:{textSize:'normal',backgroundMotion:'normal',selectionEffect:'static',renderer:'3d',graphicsQuality:'low'}}));
  },defeat);
  const loss=await last.newPage();loss.on('pageerror',e=>errors.push(e.message));
  await loss.goto(BASE_URL);await loss.getByRole('button',{name:/^이어하기/}).click();
  await loss.locator('.end-turn:not(:disabled)').waitFor({timeout:20000});
  await loss.locator('.end-turn').click();
  await loss.locator('.run-result .scene-view[aria-busy="false"]').waitFor({timeout:20000});
  const lost=await loss.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
  assert.equal(lost.run.phase,'result');assert.equal(lost.run.result.won,false);assert.equal(lost.run.hp,0);
  await loss.screenshot({path:artifactRoot+'3d-defeat.png'});
  await loss.getByRole('button',{name:'타이틀로 돌아가기',exact:true}).click();
  await loss.getByRole('button',{name:/^새 모험/}).waitFor();
  await last.close();
  console.log('fatal enemy animation completes once -> defeat result -> title');
  console.log('ERRORS',errors);assert.deepEqual(errors,[]);
}catch(error){console.log('ERRORS',errors);console.log('PAGE',await page.locator('body').innerText());await page.screenshot({path:artifactRoot+'sword3d-ui-error.png'});throw error;}
finally{await browser.close();}
