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
await page.getByRole('combobox',{name:'움직임',exact:true}).selectOption('off');
await page.locator('[data-card-type="twin"]').click();
await page.waitForFunction(()=>document.querySelector('#hit-status').textContent==='enemy:0,enemy:1');
await page.getByRole('combobox',{name:'품질',exact:true}).selectOption('low');
await page.waitForTimeout(100);
console.log('low',await controller(c=>c.__sword3d.inspect()));
await page.getByRole('button',{name:'카메라 회전',exact:true}).click();
await page.waitForTimeout(200);
await page.screenshot({path:artifactRoot+'sword3d-rotated.png'});
await page.getByRole('combobox',{name:'움직임',exact:true}).selectOption('normal');
await page.locator('[data-card-type="twin"]').click();
await page.setViewportSize({width:390,height:844});
await controller(c=>c.__sword3d.advance(2500));
await page.waitForFunction(()=>document.querySelector('#hit-status').textContent==='enemy:0,enemy:1');
console.log('resize during multi-hit animation passed');
await controller(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
await page.locator('.scene-view[data-renderer="2d"]').waitFor({timeout:10000});
await page.locator('canvas:not([data-renderer="three"])').waitFor();
console.log('context loss -> 2D fallback passed');
console.log('ERRORS',errors);assert.deepEqual(errors,[]);
await browser.close();
