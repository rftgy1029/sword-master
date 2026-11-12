import { loadHeroRig, drawHeroRig } from '../src/game/illustratedHero.js';
import { attackPose } from '../src/game/attackTimeline.js';
import { MONSTER_ROWS, monsterSheet } from '../src/game/spriteAssets.js';
import { MONSTERS } from '../src/game/catalog.js';
const rig = await loadHeroRig();
const output = document.querySelector('#status');
if (!rig) output.textContent = '일러스트를 불러오지 못했습니다.';
else {
  output.textContent = '일러스트 용사 4개 자세 · 몬스터 12종 · 투명 배경 · 부드러운 확대';
  const figures = [['대기', null, 0], ['공격 준비', 'strike', 450], ['베기', 'strike', 800], ['이동', null, 0]];
  for (const [label, type, ms] of figures) {
    const figure = document.createElement('figure'); figure.style.cssText = 'margin:0;padding:12px;background:#202c27;border:1px solid #4e5945';
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 384;
    canvas.style.cssText = 'display:block;width:240px;max-width:100%;height:auto;image-rendering:auto';
    drawHeroRig(canvas.getContext('2d'), rig, { x: 192, y: 350, scale: 5, walking: label === '이동', time: ms, armAngle: type ? attackPose(type, ms).arm : 0, motion: false });
    const caption = document.createElement('figcaption'); caption.textContent = label;
    figure.append(canvas, caption); document.querySelector('#figures').append(figure);
  }
  for (const [index, type] of MONSTER_ROWS.entries()) {
    const figure = document.createElement('figure'); figure.style.cssText = 'margin:0;padding:12px;background:#202c27;border:1px solid #4e5945';
    const art = document.createElement('div');
    art.style.cssText = `width:240px;max-width:100%;aspect-ratio:1;background-image:url(${monsterSheet});background-size:400% 300%;background-position:${index % 4 * 100 / 3}% ${Math.floor(index / 4) * 50}%`;
    const caption = document.createElement('figcaption'); caption.textContent = MONSTERS[type].name;
    figure.append(art, caption); document.querySelector('#figures').append(figure);
  }
}
