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

function treasureMapFixture(){
  let p=gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:42});
  for(let step=0;step<300;step++){
    const r=p.run,b=r.battle;
    if(r.phase==='map'&&reachableNodes(r).some(node=>node.type==='treasure'))return p;
    let action;
    if(r.phase==='map')action={type:'SELECT_NODE',id:reachableNodes(r)[0].id};
    else if(r.phase==='reward')action=!r.reward.cardTaken?{type:'SKIP_CARD'}:!r.reward.relicTaken?{type:'TAKE_RELIC'}:{type:'LEAVE_REWARD'};
    else if(b.feedback)action={type:'ACK'};
    else if(b.pending){const q=b.pending.question;action={type:'ANSWER',id:q.id,answer:q.options.find(s=>questionById(q.id).answers.includes(s))};}
    else{
      const cards=b.hand.map(uid=>r.deck.find(c=>c.uid===uid)).filter(c=>CARDS[c.type].cost<=b.energy);
      const best=cards.find(card=>CARDS[card.type].damage)??cards[0];
      action=best?{type:'SELECT_CARD',uid:best.uid}:{type:'END_TURN'};
    }
    p=gameReducer(p,action);
  }
  throw new Error('Treasure map fixture did not complete');
}

function eliteRewardFixture(){
  let p=gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:42});
  for(let step=0;step<400;step++){
    const r=p.run,b=r.battle;
    if(r.phase==='reward'&&r.reward.cards.length>0&&r.reward.relic)return p;
    let action;
    if(r.phase==='map'){
      const order={elite:100,battle:10,rest:5,treasure:5,forge:5,boss:1};
      action={type:'SELECT_NODE',id:reachableNodes(r).sort((a,b)=>(order[b.type]??0)-(order[a.type]??0))[0].id};
    }else if(r.phase==='reward')action=!r.reward.cardTaken?{type:'SKIP_CARD'}:!r.reward.relicTaken?{type:'TAKE_RELIC'}:{type:'LEAVE_REWARD'};
    else if(r.phase==='rest')action={type:'REST'};
    else if(r.phase==='forge')action={type:'LEAVE_FORGE'};
    else if(b.feedback)action={type:'ACK'};
    else if(b.pending){const q=b.pending.question;action={type:'ANSWER',id:q.id,answer:q.options.find(s=>questionById(q.id).answers.includes(s))};}
    else{
      const cards=b.hand.map(uid=>r.deck.find(c=>c.uid===uid)).filter(c=>CARDS[c.type].cost<=b.energy);
      const intent=intentFor(b.enemy);
      const score=card=>{const c=cardDetails(card);if(c.heal)return r.hp<r.maxHp-7?100:-1;if(c.focus)return cards.some(other=>other.uid!==card.uid&&cardDetails(other).damage)?90:-1;if(c.strength)return b.turn<4?50:1;if(c.block&&!c.damage)return intent.kind==='attack'&&b.block<intent.value?40:0;return(c.damage+b.strength+b.focus)*(c.hits||1)/(c.cost||1)+10;};
      cards.sort((a,b)=>score(b)-score(a));action=cards.length&&score(cards[0])>0?{type:'SELECT_CARD',uid:cards[0].uid}:{type:'END_TURN'};
    }
    p=gameReducer(p,action);
  }
  throw new Error('Elite reward fixture did not complete');
}

function restFixture(){
  let p=gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:17});
  for(let step=0;step<400;step++){
    const r=p.run,b=r.battle;
    if(r.phase==='rest'){r.hp=Math.min(r.hp,44);return p;}
    let action;
    if(r.phase==='map'){
      const order={rest:100,battle:10,treasure:5,forge:5,elite:0,boss:1};
      action={type:'SELECT_NODE',id:reachableNodes(r).sort((a,b)=>(order[b.type]??0)-(order[a.type]??0))[0].id};
    }else if(r.phase==='reward')action=!r.reward.cardTaken?{type:'SKIP_CARD'}:!r.reward.relicTaken?{type:'TAKE_RELIC'}:{type:'LEAVE_REWARD'};
    else if(r.phase==='forge')action={type:'LEAVE_FORGE'};
    else if(b.feedback)action={type:'ACK'};
    else if(b.pending){const q=b.pending.question;action={type:'ANSWER',id:q.id,answer:q.options.find(s=>questionById(q.id).answers.includes(s))};}
    else{
      const cards=b.hand.map(uid=>r.deck.find(c=>c.uid===uid)).filter(c=>CARDS[c.type].cost<=b.energy);
      const best=cards.find(card=>CARDS[card.type].damage)??cards[0];
      action=best?{type:'SELECT_CARD',uid:best.uid}:{type:'END_TURN'};
    }
    p=gameReducer(p,action);
  }
  throw new Error('Rest fixture did not complete');
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
  assert.equal(await page.locator('.tutorial-dialog[open]').count(), 0, 'Title screen opens without blocking tutorial');
  await page.getByRole('button',{name:/^이어하기/}).click();
  await page.locator('.quiz-options button:not(:disabled)').nth(3).waitFor({timeout:20000});
  assert.equal(await page.locator('.battle-quiz-backdrop').count(),0,'Inline quiz renders without a dimmed modal backdrop');
  await page.locator('.quiz-options button').nth(3).scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('.quiz-options').evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(' ').length),1);
  assert.ok(await page.locator('.quiz-options').evaluate(node=>node.clientWidth>=node.parentElement.clientWidth-40),'Mobile choices use the panel width');
  const mobileBattle=await page.evaluate(()=>{
    const topbar=document.querySelector('.is-battle-topbar')?.getBoundingClientRect();
    const statsEl=document.querySelector('.topbar-stats');
    const stats=statsEl?.getBoundingClientRect();
    const field=document.querySelector('.battlefield')?.getBoundingClientRect();
    const opts=[...document.querySelectorAll('.quiz-dock-option')].map(el=>el.getBoundingClientRect());
    return {
      topbarH:topbar?.height??999,
      statsDir:statsEl?getComputedStyle(statsEl).flexDirection:'',
      statsH:stats?.height??999,
      fieldH:field?.height??0,
      optsFit:opts.length===4&&opts.every(r=>r.left>=-1&&r.right<=innerWidth+2),
    };
  });
  assert.ok(mobileBattle.topbarH<=60,`Mobile battle topbar stays single-row (${mobileBattle.topbarH}px)`);
  assert.equal(mobileBattle.statsDir,'row','Mobile topbar stats remain horizontal');
  assert.ok(mobileBattle.statsH<=46,`Mobile topbar stats stay single-row (${mobileBattle.statsH}px)`);
  assert.ok(mobileBattle.fieldH>=90,`Mobile battlefield remains visible during inline quiz (${mobileBattle.fieldH}px)`);
  assert.equal(mobileBattle.optsFit,true,'All 4 mobile quiz options fit horizontally inside viewport');
  await shot('quiz-mobile-large');
  const q=fixture.run.battle.pending.question;
  const wrong=q.options.findIndex(s=>!questionById(q.id).answers.includes(s));
  await page.locator('.quiz-options button').nth(wrong).tap();
  await page.locator('.battle-quiz-dock.is-reveal-wrong .quiz-dock-option.is-reveal-correct').waitFor({timeout:10000});
  const p=await read();assert.equal(p.run.battle.enemy.hp,fixture.run.battle.enemy.hp);assert.equal(p.learning.entries[q.id].wrong,1);
  await page.locator('.card-hand .game-card').first().waitFor({timeout:10000});
  await page.getByRole('button',{name:'모험 닫고 타이틀로',exact:true}).click();
  console.log('360px / max text: inline quiz options reachable, wrong answer highlights answer and auto-returns without damage');
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
  assert.match(await page.locator('.weakness-list button').first().innerText(), /복습 완료/);
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
  await page.waitForFunction(()=>!document.querySelector('.scene-transition'));
  await page.getByRole('button',{name:'단어장',exact:false}).click();
  await page.locator('.vocabulary-dialog[open] .tier-tab').nth(4).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.scene-transition'));
  const mobileVocab=await page.evaluate(()=>{
    const tabs=[...document.querySelectorAll('.vocabulary-dialog[open] .tier-tab')].map(el=>el.getBoundingClientRect());
    return {
      fit:tabs.length===5&&tabs.every(r=>r.left>=-0.5&&r.right<=innerWidth+0.5&&r.width>20),
      noOverflow:document.documentElement.scrollWidth<=innerWidth,
    };
  });
  assert.equal(mobileVocab.fit,true,'All 5 vocabulary tier tabs fit within 360px viewport without clipping');
  assert.equal(mobileVocab.noOverflow,true,'Mobile vocabulary dialog has zero horizontal overflow');
  await page.getByRole('button',{name:'단어장 닫기',exact:true}).click();
  await page.locator('.vocabulary-dialog[open]').waitFor({state:'detached'});
  await page.waitForFunction(()=>!document.querySelector('.scene-transition'));
  console.log('settings: 2D -> 3D retries and reading preferences preserve all progress');
  for(const kind of ['tier','map','treasure','elite-reward','rest','forge']){
    const progress=kind==='forge'?forgeFixture():kind==='rest'?restFixture():kind==='treasure'?treasureMapFixture():kind==='elite-reward'?eliteRewardFixture():gameReducer(emptyProgress(),{type:'START',tier:'bronze',seed:42});
    const other=await browser.newContext({viewport:{width:1366,height:768}});
    await other.addInitScript(p=>{
      localStorage.setItem('sword-master.adventure.v1',JSON.stringify({version:1,progress:p}));
      localStorage.setItem('sword-master.settings.v1',JSON.stringify({version:1,settings:{textSize:'normal',backgroundMotion:'off',selectionEffect:'static',renderer:'3d',graphicsQuality:'low'}}));
    },progress);
    const view=await other.newPage();view.on('pageerror',e=>errors.push(e.message));
    await view.goto(BASE_URL);
    if(kind==='tier'){
      await view.getByRole('button',{name:/^새 모험/}).click();
      const skip=view.locator('.tutorial-dialog[open] .tutorial-skip');
      await skip.waitFor({timeout:5000});
      await skip.click();
      await view.locator('.tutorial-dialog[open]').waitFor({state:'detached'});
      await view.locator('.tier-selection .tier-choice').first().waitFor({timeout:10000});
      const tierCheck=await view.evaluate(()=>{
        const scroll=document.querySelector('.tier-selection-scroll');
        const card=document.querySelector('.tier-choice').getBoundingClientRect();
        const start=document.querySelector('.tier-start').getBoundingClientRect();
        return {
          noScroll:scroll.scrollHeight<=scroll.clientHeight+2,
          cardH:Math.round(card.height),
          startInView:start.top>=0&&start.bottom<=innerHeight,
        };
      });
      assert.equal(tierCheck.noScroll,true,'Tier selection fits in one view without scrolling');
      assert.ok(tierCheck.cardH>=200,'Tier cards have generous desktop proportions');
      assert.equal(tierCheck.startInView,true,'Tier entry CTA stays visible without scrolling');
      await view.screenshot({path:`${artifactRoot}3d-tier-select.png`});
      console.log('tier selection: generous 5-tier cards, scope brief, and entry button fit in one view');
      await other.close();
      continue;
    }
    await view.getByRole('button',{name:/^이어하기/}).click();
    if(kind==='map'){
      await view.locator('.map-overview .route-map').waitFor({timeout:20000});
      const layout=await view.locator('.map-overview').evaluate(board=>{
        const box=board.getBoundingClientRect();
        const tiles=[...board.querySelectorAll('.route-node, .route-entrance')].map(tile=>tile.getBoundingClientRect());
        const inside=tiles.every(r=>r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom);
        const overlap=tiles.some((a,i)=>tiles.slice(i+1).some(b=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1));
        return {inside,overlap,count:board.querySelectorAll('.route-node').length};
      });
      assert.equal(layout.count,progress.run.map.flat().length,'Every dungeon room is drawn on the route map');
      assert.equal(layout.inside,true,'All dungeon rooms fit inside the route map');
      assert.equal(layout.overlap,false,'Route map rooms never overlap each other');
      const glowing=await view.locator('.route-node.is-reachable').evaluateAll(nodes=>nodes.map(node=>node.dataset.routeNode).sort());
      assert.deepEqual(glowing,reachableNodes(progress.run).map(node=>node.id).sort(),'Only engine-reachable rooms are orange');
      assert.equal(await view.locator('.map-route-options button:not(:disabled)').count(),reachableNodes(progress.run).length);
      assert.equal(await view.locator('.game-body').evaluate(body=>body.scrollHeight<=body.clientHeight+1),true,'Map and next routes fit without page scrolling');
      assert.equal(await view.locator('.map-selection').evaluate(panel=>panel.scrollHeight<=panel.clientHeight+1),true,'Route panel fits without its own scrolling');
      await view.screenshot({path:`${artifactRoot}route-map.png`});
      await view.locator(`.route-node[data-route-node="${reachableNodes(progress.run)[0].id}"]`).click();
      await view.locator('.battle-screen').waitFor();
      const saved=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
      assert.equal(saved.run.floor,0);assert.equal(saved.run.phase,'battle');
      console.log('route map room selects the real dungeon node; rooms and next routes fit without overlap or scrolling');
    }else if(kind==='treasure'){
      const treasure=reachableNodes(progress.run).find(node=>node.type==='treasure');
      await view.locator(`.map-route-options .map-node[data-node-id="${treasure.id}"]`).click();
      await view.locator('.reward-screen .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      await view.locator('.run-inspect-buttons').getByRole('button',{name:'경로'}).click();
      await view.locator('.inspection.is-map .dungeon-map').waitFor();
      await view.getByRole('button',{name:'← 모험으로 돌아가기'}).click();
      await view.locator('.reward-screen .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      const beforeLevel=await view.locator('.relic-item h4').innerText();
      await view.getByRole('button',{name:/유물 획득|유물 Lv.2로 강화/}).click();
      const afterLevel=await view.locator('.relic-item h4').innerText();
      assert.equal(afterLevel,beforeLevel,'Claimed relic keeps its acquired level label');
      const rewardNext=await view.evaluate(()=>{
        const scroll=document.querySelector('.phase-scroll');
        const content=document.querySelector('.phase-content');
        const btn=document.querySelector('.phase-next-action');
        const r=btn.getBoundingClientRect();
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return {
          noScroll:scroll.scrollHeight<=scroll.clientHeight+2,
          contentWidth:Math.round(content.getBoundingClientRect().width),
          inViewport:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
          clickable:btn.contains(hit),
          disabled:btn.disabled,
          focused:document.activeElement===btn,
        };
      });
      assert.equal(rewardNext.noScroll,true,'Treasure reward fits in a single view without vertical scrolling');
      assert.ok(rewardNext.contentWidth>=900,'Reward content keeps full desktop width after map transitions');
      assert.equal(rewardNext.inViewport,true,'Reward next-route button stays visible inside the viewport');
      assert.equal(rewardNext.clickable,true,'Reward next-route button is not occluded');
      assert.equal(rewardNext.disabled,false,'Reward next-route button enables once relic is claimed');
      assert.equal(rewardNext.focused,true,'Reward next-route button receives focus once ready');
      await view.screenshot({path:`${artifactRoot}3d-treasure-reward.png`});
      await view.locator('.phase-next-action').click();
      await view.locator('.dungeon-map').waitFor();
      console.log('treasure reward: map -> reward -> inspect -> reward fits in one view with always-visible next button');
    }else if(kind==='elite-reward'){
      await view.locator('.reward-screen .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      const singleView=await view.evaluate(()=>{
        const scroll=document.querySelector('.phase-scroll');
        const sr=scroll.getBoundingClientRect();
        const cards=[...document.querySelectorAll('.reward-cards .game-card')];
        const artLoaded=[...document.querySelectorAll('.reward-cards .card-art-img')].every(img=>img.complete&&img.naturalWidth>100);
        const relic=document.querySelector('.relic-reward');
        const rr=relic.getBoundingClientRect();
        const btn=document.querySelector('.phase-next-action');
        const br=btn.getBoundingClientRect();
        return {
          noScroll:scroll.scrollHeight<=scroll.clientHeight+2,
          cardsCount:cards.length,
          artLoaded,
          cardsInView:cards.every(el=>{const cr=el.getBoundingClientRect();return cr.top>=sr.top-2&&cr.bottom<=sr.bottom+2;}),
          relicInView:rr.top>=sr.top-2&&rr.bottom<=sr.bottom+2,
          btnInView:br.top>=0&&br.bottom<=innerHeight,
          btnDisabled:btn.disabled,
        };
      });
      assert.equal(singleView.noScroll,true,'Elite reward (cards + relic + next button) fits in one view without scrolling');
      assert.equal(singleView.cardsCount,3,'Elite reward displays all 3 card choices');
      assert.equal(singleView.artLoaded,true,'All reward card illustrations load cleanly');
      assert.equal(singleView.cardsInView,true,'All 3 reward cards are visible without scrolling');
      assert.equal(singleView.relicInView,true,'Elite relic reward is visible without scrolling');
      assert.equal(singleView.btnInView,true,'Next-route button is visible before claiming');
      assert.equal(singleView.btnDisabled,true,'Next-route button stays disabled until card and relic are claimed');
      await view.locator('.reward-cards .game-card').first().click();
      assert.equal(await view.locator('.reward-card-slot.is-picked').count(),1,'Chosen reward card stays highlighted');
      await view.getByRole('button',{name:/유물 획득|유물 Lv.2로 강화/}).click();
      const done=await view.evaluate(()=>{
        const btn=document.querySelector('.phase-next-action');
        return {disabled:btn.disabled,focused:document.activeElement===btn};
      });
      assert.equal(done.disabled,false,'Next-route button enables once both card and relic are claimed');
      assert.equal(done.focused,true,'Next-route button receives focus once both rewards are claimed');
      await view.screenshot({path:`${artifactRoot}3d-elite-reward.png`});
      await view.locator('.phase-next-action').click();
      await view.locator('.dungeon-map').waitFor();
      console.log('elite reward: 3D scene, relic, 3 illustrated cards and next-route button fit in one view without scrolling');
    }else if(kind==='rest'){
      await view.locator('.rest-screen .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      const restView=await view.evaluate(()=>{
        const scroll=document.querySelector('.phase-scroll');
        const heal=document.querySelector('.rest-action').getBoundingClientRect();
        const col=document.querySelector('.rest-forge-col').getBoundingClientRect();
        return {
          noScroll:scroll.scrollHeight<=scroll.clientHeight+2,
          healInView:heal.top>=0&&heal.bottom<=innerHeight,
          upgradeInView:col.top>=0&&col.bottom<=innerHeight,
        };
      });
      assert.equal(restView.noScroll,true,'Rest screen fits in one view without outer page scrolling');
      assert.equal(restView.healInView,true,'Rest heal action stays visible without scrolling');
      assert.equal(restView.upgradeInView,true,'Rest free upgrade panel stays visible without scrolling');
      await view.screenshot({path:`${artifactRoot}3d-rest.png`});
      console.log('3D rest: campfire heal and free upgrade list fit side-by-side in one view');
    }else{
      await view.locator('.location-scene .scene-view[aria-busy="false"]').waitFor({timeout:20000});
      const forgeView=await view.evaluate(()=>{
        const scroll=document.querySelector('.phase-scroll');
        const btn=document.querySelector('.phase-next-action');
        const r=btn.getBoundingClientRect();
        return {
          noScroll:scroll.scrollHeight<=scroll.clientHeight+2,
          nextVisible:r.top>=0&&r.bottom<=innerHeight&&btn.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)),
        };
      });
      assert.equal(forgeView.noScroll,true,'Forge fits in one view without outer page scrolling');
      assert.equal(forgeView.nextVisible,true,'Forge next-route button stays visible without scrolling');
      const oldGold=progress.run.gold;
      await view.locator('.upgrade-list .upgrade-item:not(:disabled)').first().click();
      let saved=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
      assert.equal(saved.run.gold,oldGold-30);assert.ok(saved.run.deck.some(card=>card.upgraded));
      await view.getByRole('button',{name:/^유물 강화/}).click();
      const relic=view.locator('.relic-item button').first();
      if(saved.run.gold>=45){await relic.click();const next=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);assert.equal(next.run.gold,saved.run.gold-45);saved=next;}
      else assert.equal(await relic.isDisabled(),true);
      await view.getByRole('button',{name:/^카드 구입/}).click();
      const shopFits=await view.evaluate(()=>{
        const scroll=document.querySelector('.phase-scroll');
        const sr=scroll.getBoundingClientRect();
        const cards=[...document.querySelectorAll('.forge-shop-cards .game-card')];
        return scroll.scrollHeight<=scroll.clientHeight+2&&cards.every(el=>{const r=el.getBoundingClientRect();return r.top>=sr.top-2&&r.bottom<=sr.bottom+2;});
      });
      assert.equal(shopFits,true,'Forge shop displays all 3 illustrated cards without scrolling');
      const stock=view.locator('.reward-cards button');
      if(saved.run.gold>=35){await stock.first().click();const next=await view.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);assert.equal(next.run.gold,saved.run.gold-35);}
      else for(const button of await stock.all())assert.equal(await button.isDisabled(),true);
      await view.screenshot({path:`${artifactRoot}3d-forge.png`});
      console.log('3D forge: card upgrade, relic upgrade and single-view illustrated shop follow real gold costs');
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
  await loss.goto(BASE_URL);
  await loss.getByRole('button',{name:/^이어하기/}).click();
  await loss.locator('.end-turn:not(:disabled)').waitFor({timeout:20000});
  await loss.waitForFunction(()=>!document.querySelector('.scene-transition'));
  await loss.locator('.end-turn').click();
  await loss.locator('.run-result .scene-view[aria-busy="false"]').waitFor({timeout:35000});
  const lost=await loss.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.adventure.v1')).progress);
  assert.equal(lost.run.phase,'result');assert.equal(lost.run.result.won,false);assert.equal(lost.run.hp,0);
  await loss.screenshot({path:artifactRoot+'3d-defeat.png'});
  await loss.getByRole('button',{name:'타이틀로 돌아가기',exact:true}).click();
  await loss.getByRole('button',{name:/^새 모험/}).waitFor();
  assert.equal(await loss.locator('.survey-button').count(),0,'A defeat does not open the survey menu');
  await last.close();
  console.log('fatal enemy animation completes once -> defeat result -> title');
  const cleared=structuredClone(emptyProgress());cleared.learning.clears.bronze=1;
  const surveyContext=await browser.newContext({viewport:{width:360,height:740},hasTouch:true,isMobile:true});
  await surveyContext.addInitScript(p=>{localStorage.setItem('sword-master.adventure.v1',JSON.stringify({version:1,progress:p}));},cleared);
  const survey=await surveyContext.newPage();survey.on('pageerror',e=>errors.push(e.message));
  await survey.goto(BASE_URL);
  await survey.locator('.scene-view[aria-busy="false"]').waitFor({timeout:25000});
  assert.equal(await survey.locator('.graphics-setup-card').count(),0,'First visit auto-initializes graphics quality without a blocking picker');
  const persistedSettings=await survey.evaluate(()=>JSON.parse(localStorage.getItem('sword-master.settings.v1')||'null'));
  assert.ok(['lowest','low'].includes(persistedSettings?.settings?.graphicsQuality),`Expected mobile/SwiftShader auto quality (lowest or low), got ${persistedSettings?.settings?.graphicsQuality}`);
  assert.equal(await survey.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const surveyButton=survey.getByRole('button',{name:/^설문 참여/});
  await surveyButton.waitFor();
  assert.equal(await survey.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await surveyButton.click();
  await survey.locator('.survey-dialog[open]').waitFor();
  assert.match(await survey.locator('.survey-record').innerText(),/브론즈/);
  const link=survey.locator('a.survey-open');
  if(await link.count()){assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('rel'),/noopener/);assert.match(await link.getAttribute('href'),/^https:\/\/(forms\.gle|docs\.google\.com\/forms)\//);}
  else assert.equal(await survey.locator('button.survey-open').isDisabled(),true,'An unset form address never opens a link');
  await survey.waitForFunction(()=>!document.querySelector('.scene-transition'));
  await survey.screenshot({path:artifactRoot+'survey-mobile.png'});
  await survey.keyboard.press('Escape');
  await survey.waitForFunction(()=>!document.querySelector('.survey-dialog')&&document.activeElement?.textContent.includes('설문 참여'));
  await surveyContext.close();
  console.log('survey: hidden until a school tier clear, opens a safe Google Form link, Escape restores menu focus');
  console.log('ERRORS',errors);assert.deepEqual(errors,[]);
}catch(error){console.log('ERRORS',errors);console.log('PAGE',await page.locator('body').innerText());await page.screenshot({path:artifactRoot+'sword3d-ui-error.png'});throw error;}
finally{await browser.close();}
