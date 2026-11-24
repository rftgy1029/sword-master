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
import {QUESTION_BANK,questionById} from '../src/game/quiz.js';
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
  const tutorial = page.locator('.tutorial-dialog[open]');
  assert.equal(await tutorial.count(), 0, 'Title screen appears cleanly before opening the tutorial');
  await capture('title-desktop');
  await page.getByRole('button',{name:'새 모험',exact:false}).click();
  await tutorial.waitFor();
  await page.waitForFunction(()=>!document.querySelector('.scene-transition'));
  await capture('tutorial-in-new-adventure');
  await tutorial.locator('.game-card').click();
  const term = await tutorial.locator('#quiz-heading').innerText();
  const source = QUESTION_BANK.find((item) => item.word.term === term && item.type === 'meaning');
  const options = tutorial.locator('.quiz-options');
  const wrong = (await options.locator('strong').allTextContents()).find((option) => option !== source.word.meaning);
  await options.getByText(wrong, { exact: true }).click();
  await tutorial.getByRole('button', { name: '같은 문제 다시 풀기' }).click();
  await options.getByText(source.word.meaning, { exact: true }).click();
  await tutorial.getByRole('button', { name: '턴 종료', exact: true }).click();
  await tutorial.getByRole('button', { name: '새 모험 시작' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('sword-master.adventure.v1')), null,
    'Practice neither starts a saved adventure nor writes learning records');
  await page.locator('.tier-start').waitFor();
  await capture('new-adventure-desktop');
  await page.locator('.tier-tutorial-button').click();
  await tutorial.waitFor();
  await tutorial.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await tutorial.waitFor({ state: 'detached' });
  await page.reload();
  await page.locator('.scene-view[aria-busy="false"]').waitFor({timeout:25000});
  assert.equal(await tutorial.count(), 0, 'Reloading returns to title without auto-opening tutorial');
  await page.getByRole('button',{name:'새 모험',exact:false}).click();
  await tutorial.waitFor();
  await tutorial.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await page.getByRole('button',{name:'던전 입장'}).click();
  await page.locator('.dungeon-entrance canvas[data-renderer="three"]').waitFor();
  await capture('entrance');
  await page.locator('.dungeon-map').waitFor({timeout:25000});
  await page.locator('.map-overview .route-map').waitFor();
  await capture('map');
  let restored=false,realAttack=false,rewardShot=false,battleShot=false,postQuizFocusChecked=false;
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
      if(b.feedback.correct){
        if(!realAttack&&b.effect.kind==='attack'){
          await page.waitForFunction(()=>{
            const saved=JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress;
            return saved.run.phase!=='battle'||!saved.run.battle?.feedback;
          },{},{timeout:20000});
          realAttack=true;console.log(MOTION==='normal'?'real-time 3D attack completed and auto-advanced':'reduced-motion 3D effect auto-advanced');
        }else{
          await settle();
          await page.waitForFunction(()=>{
            const saved=JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress;
            return saved.run.phase!=='battle'||!saved.run.battle?.feedback;
          },{},{timeout:20000});
        }
      }else{
        await settle();
        await page.waitForFunction(()=>{
          const saved=JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress;
          return saved.run.phase!=='battle'||!saved.run.battle?.feedback;
        },{},{timeout:20000});
      }
    }else if(b.pending){
      await page.locator('.quiz-options button:not(:disabled)').first().waitFor();
      if(!restored){
        const old=structuredClone(b.pending),energy=b.energy;
        assert.equal(await page.locator('.battle-quiz-backdrop').count(),0,'Inline dock quiz never covers the battlefield');
        await page.locator('.battle-dock .battle-quiz-dock').waitFor();
        await capture('quiz-desktop');
        await page.locator('.is-battle-topbar .battle-menu summary').click();
        await page.getByRole('button',{name:'모험 닫고 타이틀로',exact:true}).click();
        await page.evaluate(() => localStorage.setItem('sword-master.adventure.v1.tutorial', 'seen'));
        await page.reload();
        await page.locator('.scene-view[aria-busy="false"]').waitFor({timeout:25000});
        assert.equal(await tutorial.count(), 0, 'Returning player lands on title without auto-opening tutorial');
        await page.getByRole('button',{name:/^새 모험/}).click();
        await tutorial.waitFor();
        await tutorial.locator('.game-card').click();
        await options.getByText(source.word.meaning, { exact: true }).click();
        await tutorial.getByRole('button', { name: '턴 종료', exact: true }).click();
        await tutorial.getByRole('button', { name: '새 모험 시작', exact: true }).click();
        await page.locator('.tier-start').waitFor();
        assert.deepEqual(await read(), p, 'Replaying the tutorial in 새 모험 preserves the entire saved adventure');
        await page.getByRole('button',{name:'모험 닫고 타이틀로',exact:true}).click();
        await page.locator('.game-dialog').waitFor({ state: 'detached' });
        await page.getByRole('button',{name:/^이어하기/}).click();
        assert.equal(await tutorial.count(), 0, 'Resuming an adventure skips the tutorial');
        await page.locator('.quiz-options button:not(:disabled)').first().waitFor({timeout:20000});
        const resumed=await read();assert.deepEqual(resumed.run.battle.pending,old);assert.equal(resumed.run.battle.energy,energy);
        restored=true;console.log('unanswered quiz reload: returning player tutorial in 새 모험 + direct 이어하기 preserved exact quiz');
      }
      const q=b.pending.question,answer=q.options.find(s=>questionById(q.id).answers.includes(s));
      await page.locator('.quiz-options button').nth(q.options.indexOf(answer)).click();
    }else{
      await settle();
      if(!battleShot){
        const initialBattleState = await page.evaluate(() => {
          const hud = document.querySelector('.battle-stage > .combat-hud.is-slim')?.getBoundingClientRect();
          const field = document.querySelector('.battlefield')?.getBoundingClientRect();
          const focusedCard = document.querySelector('.card-hand .game-card:focus, .card-hand .game-card:focus-visible');
          const previewTags = document.querySelectorAll('.health-preview-tag').length;
          return { hudBottom: hud?.bottom ?? Infinity, fieldTop: field?.top ?? 0, hasFocusedCard: Boolean(focusedCard), previewTags };
        });
        assert.equal(initialBattleState.hudBottom <= initialBattleState.fieldTop + 2, true, 'Top combat HP bar strip sits cleanly above the battlefield');
        assert.equal(initialBattleState.hasFocusedCard, false, 'No hand card is automatically focused or lifted on battle start');
        assert.equal(initialBattleState.previewTags, 0, 'No card damage preview activates before hover or keyboard selection');
        await capture('battle-desktop');
        const attackCard=b.hand.map(uid=>r.deck.find(c=>c.uid===uid)).find(c=>CARDS[c.type].damage&&CARDS[c.type].cost<=b.energy);
        if(attackCard){
          await page.locator(`.card-hand [data-card-uid="${attackCard.uid}"]`).hover();
          await page.locator('.enemy-hud .health-preview-tag').waitFor({timeout:5000});
          await capture('battle-hover-preview');
          await page.mouse.move(10,10);
          await page.waitForFunction(() => document.querySelectorAll('.health-preview-tag').length === 0, {}, { timeout: 5000 });
        }
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(() => document.activeElement?.matches('.card-hand .game-card') ?? false), true, 'ArrowRight moves keyboard focus into the card hand');
        await page.evaluate(() => document.querySelector('.card-hand')?.focus({ preventScroll: true }));
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await capture('battle-mobile');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:1440,height:900});battleShot=true;
      } else if (restored && !postQuizFocusChecked) {
        const focusedCard = await page.evaluate(() => Boolean(document.querySelector('.card-hand .game-card:focus, .card-hand .game-card:focus-visible')));
        assert.equal(focusedCard, false, 'No hand card is automatically focused or lifted after finishing a quiz');
        postQuizFocusChecked = true;
      }
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
