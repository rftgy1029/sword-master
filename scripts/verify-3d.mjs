import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const artifactRoot=fileURLToPath(new URL('../artifacts/',import.meta.url));
mkdirSync(artifactRoot,{recursive:true});
const BASE_URL=process.env.BROWSER_BASE_URL??'http://127.0.0.1:8175/';
import assert from 'node:assert/strict';
import { ATTACK_HITS } from '../src/game/attackTimeline.js';
import { CARD_MOTIONS } from '../src/game/cardMotions.js';
import {chromium} from 'playwright';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(new URL('dev/three-preview.html',BASE_URL).href);
await page.locator('#scene-status').filter({hasText:'장면 준비 완료'}).waitFor({timeout:30000});
await page.getByRole('combobox',{name:'품질',exact:true}).selectOption('low');
const canvas=page.locator('canvas[data-renderer="three"]');
const controller=fn=>canvas.evaluate(fn);
const canvasSample=at=>canvas.evaluate((element, time)=>element.__sword3d.sample(time),at);
if(process.env.BROWSER_3D_PART!=='upgraded'){
const beforeArm=await controller(c=>c.__sword3d.scene.getObjectByName('hero').getObjectByName('arm_right').quaternion.toArray());
await canvasSample(CARD_MOTIONS.strike.marks.windup);
await page.locator('[data-card-type="strike"]').click();
await page.waitForFunction(before=>{
  const arm=document.querySelector('canvas[data-renderer="three"]')?.__sword3d?.scene.getObjectByName('hero')?.getObjectByName('arm_right');
  return arm&&arm.quaternion.toArray().some((value,i)=>Math.abs(value-before[i])>.05);
},beforeArm);
const preparedArm=await controller(c=>c.__sword3d.scene.getObjectByName('hero').getObjectByName('arm_right').quaternion.toArray());
await canvasSample(ATTACK_HITS.strike[0]);
await page.waitForFunction(before=>{
  const arm=document.querySelector('canvas[data-renderer="three"]')?.__sword3d?.scene.getObjectByName('hero')?.getObjectByName('arm_right');
  return arm&&arm.quaternion.toArray().some((value,i)=>Math.abs(value-before[i])>.05);
},preparedArm);
await page.screenshot({path:artifactRoot+'3d-melee-contact.png'});
await controller(c=>c.__sword3d.advance(2500));
console.log('actual GLB weapon joint changes at the sampled attack frame');
for(const type of ['crawler','sentinel','ember','bat','slime','mushroom','scarab','wisp','hound','ravager','watcher','boss']){
  await page.getByRole('combobox',{name:'몬스터',exact:true}).selectOption(type);
  await page.locator('#scene-status').filter({hasText:'장면 준비 완료'}).waitFor({timeout:20000});
  await page.getByRole('button',{name:'몬스터 다단 공격',exact:true}).click();
  await controller(c=>c.__sword3d.advance(3000));
  await page.waitForFunction(()=>document.querySelector('#hit-status').textContent==='player:0,player:1,player:2');
  assert.equal(await controller(c=>c.__sword3d.inspect().active),false);
  console.log('enemy',type,'3 hit callbacks passed');
}
for(const type of ['strike','guard','heavy','twin','heal','empower','weaken','focus','flow','flare','nova','oath']){
  await page.locator(`[data-card-type="${type}"]`).click();
  await controller(c=>c.__sword3d.advance(700));
  await page.waitForTimeout(90);
  if(type==='twin')await page.screenshot({path:artifactRoot+'sword3d-skill.png'});
  await controller(c=>c.__sword3d.advance(2500));
  await page.locator('#scene-status').filter({hasText:'연출 완료'}).waitFor();
  const hits=await page.locator('#hit-status').textContent();
  const expected=type==='twin'?'enemy:0,enemy:1':['strike','heavy','flare','nova'].includes(type)?'enemy:0':'';
  assert.equal(hits,expected,type);
  console.log('card',type,'passed');
}
}
await page.getByRole('checkbox',{name:'강화 카드'}).check();
for(const type of ['strike','guard','heavy','twin','heal','empower','weaken','focus','flow','flare','nova','oath']){
  const expected=await controller(c=>c.__sword3d.inspect().lastEffectId+1);
  await canvasSample(CARD_MOTIONS[type].hits?.[0] ?? CARD_MOTIONS[type].moment);
  await page.locator(`[data-card-type="${type}"]`).click();
  await page.waitForFunction(expected=>{
    const api=document.querySelector('canvas[data-renderer="three"]')?.__sword3d;
    const effect=api?.scene.getObjectByName('skill-effects');
    return effect?.userData.effectId===expected&&effect.userData.upgraded&&api.scene.getObjectByName('upgraded-halo')?.visible;
  },expected);
  await controller(c=>c.__sword3d.advance(2500));
  await page.locator('#scene-status').filter({hasText:'연출 완료'}).waitFor();
  console.log('upgraded card',type,'halo passed');
}
const motion = page.getByRole('combobox', { name: '움직임', exact: true });
const quality = page.getByRole('combobox', { name: '품질', exact: true });
const cardButton = (type) => page.locator(`[data-card-type="${type}"]`);
const hits = (expected) => page.waitForFunction(
  (value) => document.querySelector('#hit-status').textContent === value, expected);
const completed = () => page.locator('#scene-status').filter({ hasText: '연출 완료' }).waitFor();

await page.getByRole('checkbox', { name: '강화 카드' }).uncheck();
await quality.selectOption('high');
await page.waitForFunction(() => document.querySelector('canvas[data-renderer="three"]')?.__sword3d?.inspect().bloom);
await canvasSample(CARD_MOTIONS.nova.hits[0]);
await cardButton('nova').click();
await hits('enemy:0');
assert.equal(await controller((c) => c.__sword3d.scene.getObjectByName('nova-column').visible), true);
await page.locator('.preview-arena').screenshot({ path: artifactRoot + 'overhaul-high-nova.png' });
await controller((c) => c.__sword3d.settle());
await quality.selectOption('low');

await page.getByRole('button', { name: '완전 방어', exact: true }).click();
await hits('player:0');
await page.locator('.combat-hit-number.is-blocked').filter({ hasText: '방어' }).waitFor();
await completed();
await page.getByRole('checkbox', { name: '적 처치' }).check();
await cardButton('strike').click();
await hits('enemy:0');
await completed();
const monster = await page.getByRole('combobox', { name: '몬스터' }).inputValue();
await page.waitForFunction((type) => document.querySelector('canvas[data-renderer="three"]')?.__sword3d
  ?.scene.getObjectByName(`actor-${type}`)?.visible === false, monster);
await page.getByRole('checkbox', { name: '적 처치' }).uncheck();

await motion.selectOption('reduced');
await cardButton('twin').click();
await page.locator('.combat-scene[data-motion="calm"]').waitFor();
await hits('enemy:0,enemy:1');
await completed();
await motion.selectOption('off');
await cardButton('twin').click();
await hits('enemy:0,enemy:1');
await completed();
await motion.selectOption('normal');
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.locator('.combat-scene[data-motion="calm"]').waitFor();
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.locator('.combat-scene[data-motion="full"]').waitFor();

await page.evaluate(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await cardButton('twin').click();
await page.waitForFunction(() => document.querySelector('canvas[data-renderer="three"]')?.__sword3d?.inspect().active);
assert.equal(await controller((c) => c.__sword3d.inspect().elapsed), 0);
assert.equal(await page.locator('#hit-status').textContent(), '');
await canvasSample(ATTACK_HITS.twin[0]);
await page.evaluate(() => {
  delete document.hidden;
  document.dispatchEvent(new Event('visibilitychange'));
});
await hits('enemy:0');
await page.setViewportSize({ width: 390, height: 844 });
await controller((c) => c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
await page.locator('.scene-view[data-renderer="2d"] canvas').waitFor({ timeout: 10000 });
await hits('enemy:0,enemy:1');
await completed();
await cardButton('strike').click();
await hits('enemy:0');
await completed();
console.log('high quality bloom, blocked hit, defeat, motion settings, resize and in-flight 3D → 2D recovery passed');
console.log('ERRORS',errors);assert.deepEqual(errors,[]);
await browser.close();
