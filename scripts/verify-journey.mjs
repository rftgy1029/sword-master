import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const artifactRoot=fileURLToPath(new URL('../artifacts/',import.meta.url));
mkdirSync(artifactRoot,{recursive:true});
const MOTION=process.env.BROWSER_MOTION??'normal';
const BASE_URL=process.env.BROWSER_BASE_URL??'http://127.0.0.1:8175/';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CARDS,cardDetails} from '../src/game/catalog.js';
import {intentFor,reachableNodes} from '../src/game/engine.js';
import {questionById} from '../src/game/quiz.js';
import {writeFileSync} from 'node:fs';

const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
await context.addInitScript(motion=>{
  if(!localStorage.getItem('sword-master.settings.v1'))localStorage.setItem('sword-master.settings.v1',JSON.stringify({version:1,settings:{textSize:'normal',backgroundMotion:motion,selectionEffect:'static',renderer:'3d',graphicsQuality:'low'}}));
  const original=crypto.getRandomValues.bind(crypto);
  Object.defineProperty(crypto,'getRandomValues',{value:array=>{if(array instanceof Uint32Array&&array.length===1){array[0]=42;return array;}return original(array);}});
},MOTION);
const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
const settle=async()=>{
  await page.evaluate(()=>document.querySelector('canvas[data-renderer="three"]')?.__sword3d?.advance(6000));
  await page.waitForFunction(()=>!document.querySelector('.battle-screen[aria-busy="true"]'),{},{timeout:20000});
};
const capture=async(name)=>{await page.screenshot({path:`${artifactRoot}3d-${name}.png`});};
try{
  await page.goto(BASE_URL);
  await page.locator('.scene-view[aria-busy="false"]').waitFor({timeout:25000});
  await capture('title-desktop');
  await page.getByRole('button',{name:'새 모험',exact:false}).click();
  await page.getByRole('button',{name:'던전 입장'}).click();
  await page.locator('.dungeon-entrance canvas[data-renderer="three"]').waitFor();
  await capture('entrance');
  await page.locator('.dungeon-map').waitFor({timeout:25000});
  await page.locator('.map-overview .scene-view[aria-busy="false"]').waitFor();
  await capture('map');
  let restored=false,realAttack=false,rewardShot=false,battleShot=false;
  for(let step=0;step<650;step++){
    await page.waitForFunction(()=>!document.querySelector('.scene-transition'));
    const p=await read();const r=p.run,b=r.battle;
    if(r.phase==='result'){
      await page.locator('.run-result').waitFor();
      await capture('result');
      assert.equal(r.result.won,true,'Seed 42 adventure wins through the actual UI');
      console.log('COMPLETE',JSON.stringify({steps:step,correct:r.correct,answers:r.answers,clears:p.learning.clears,unlocked:p.learning.unlocked}));
      writeFileSync(artifactRoot+'sword-journey-result.json',JSON.stringify(p));
      break;
    }
    if(step%20===0)console.log('STEP',step,r.phase,r.floor,r.hp);
    if(r.phase==='map'){
      const priority={rest:10,treasure:9,battle:5,forge:3,elite:0,boss:10};
      const node=reachableNodes(r).sort((a,b)=>priority[b.type]-priority[a.type])[0];
      await page.locator(`.map-route-options .map-node[aria-label^="${node.floor+1}층 ${node.lane+1}번"]`).click();
    }else if(r.phase==='reward'){
      if(!rewardShot){await page.locator('.reward-screen').waitFor();await capture('reward');rewardShot=true;}
      if(!r.reward.cardTaken){const type=r.reward.cards.find(t=>['nova','twin','heal'].includes(t))??r.reward.cards[0];await page.locator('.reward-cards .game-card').filter({hasText:CARDS[type].name}).click();}
      else if(!r.reward.relicTaken)await page.getByRole('button',{name:/유물 획득|유물 Lv.2로 강화/}).click();
      else await page.getByRole('button',{name:'다음 경로로',exact:false}).click();
    }else if(r.phase==='rest'){
      await page.locator('.rest-action').click();
    }else if(r.phase==='forge'){
      await page.getByRole('button',{name:'다음 경로로',exact:false}).click();
    }else if(b.feedback){
      if(!realAttack&&b.effect.kind==='attack'){
        await page.locator('.quiz-feedback .game-primary').waitFor({timeout:20000});
        realAttack=true;console.log(MOTION==='normal'?'real-time 3D attack completed':'reduced-motion 3D effect completed');
      }else await settle();
      await page.locator('.quiz-feedback .game-primary').click();
    }else if(b.pending){
      await page.locator('.quiz-options button').first().waitFor();
      if(!restored){
        const old=structuredClone(b.pending),energy=b.energy;
        await capture('quiz-desktop');
        await page.getByRole('button',{name:'모험 닫고 타이틀로',exact:true}).click();
        await page.reload();
        await page.getByRole('button',{name:/^이어하기/}).click();
        await page.locator('.quiz-options button').first().waitFor({timeout:20000});
        const resumed=await read();assert.deepEqual(resumed.run.battle.pending,old);assert.equal(resumed.run.battle.energy,energy);
        restored=true;console.log('unanswered quiz reload: exact question, card and energy preserved');
      }
      const q=b.pending.question,answer=q.options.find(s=>questionById(q.id).answers.includes(s));
      await page.locator('.quiz-options button').nth(q.options.indexOf(answer)).click();
    }else{
      await settle();
      if(!battleShot){await capture('battle-desktop');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await capture('battle-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1440,height:900});battleShot=true;}
      const cards=b.hand.map(uid=>r.deck.find(c=>c.uid===uid)).filter(c=>CARDS[c.type].cost<=b.energy);
      const intent=intentFor(b.enemy);
      const score=card=>{const c=cardDetails(card);if(c.heal)return r.hp<r.maxHp-7?100:-1;if(c.focus)return cards.some(other=>other.uid!==card.uid&&cardDetails(other).damage)?90:-1;if(c.strength)return b.turn<4?50:1;if(c.block&&!c.damage)return intent.kind==='attack'&&b.block<intent.value?40:0;if(c.weak)return intent.value>=10&&b.enemy.weak<1?30:0;return(c.damage+b.strength+b.focus)*(c.hits||1)/(c.cost||1)+10;};
      cards.sort((a,b)=>score(b)-score(a));
      if(cards.length&&score(cards[0])>0)await page.locator(`.card-hand [data-card-uid="${cards[0].uid}"]`).click();
      else await page.locator('.end-turn').click();
    }
    await page.waitForFunction(before=>JSON.stringify(JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress)!==before,JSON.stringify(p),{timeout:20000});
  }
  assert.equal((await read()).run.result?.won,true);
  console.log('ERRORS',errors);assert.deepEqual(errors,[]);
}catch(error){console.log('DIAGNOSTICS',errors);console.log('PAGE',await page.locator('body').innerText());await page.screenshot({path:artifactRoot+'sword3d-flow-error.png'});throw error;}
finally{await browser.close();}
