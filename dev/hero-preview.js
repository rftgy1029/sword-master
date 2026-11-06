import { loadHeroRig, drawHeroRig } from '../src/game/heroRig.js';
import { attackPose } from '../src/game/attackTimeline.js';
const rig = await loadHeroRig();
const output = document.querySelector('#status');
if (!rig) output.textContent = '불러오기 실패';
else {
  const verify = document.createElement('canvas'); verify.width = verify.height = 64;
  const ctx = verify.getContext('2d', { willReadFrequently: true });
  drawHeroRig(ctx, rig, { x: 32, y: 61, motion: false });
  const actual = ctx.getImageData(0, 0, 64, 64).data;
  const expected = rig.original.getContext('2d').getImageData(0, 0, 64, 64).data;
  let different = 0;
  for (let i = 0; i < actual.length; i += 4) {
    if (actual[i + 3] !== expected[i + 3] || (actual[i + 3] && [0, 1, 2].some((offset) => actual[i + offset] !== expected[i + offset]))) different++;
  }
  output.textContent = different ? `원본 일치 실패: ${different}픽셀` : '64×64 원본 픽셀 전부 일치 · 수정한 눈/얼굴 보존';
  const figures = [['정지 원본', null, 0], ['검의 궤적 준비', 'strike', 450], ['검의 궤적 타격', 'strike', 800], ['균열 내려찍기', 'heavy', 1000], ['쌍월 2차 타격', 'twin', 1100], ['복귀', 'strike', 2000]];
  for (const [label, type, ms] of figures) {
    const figure = document.createElement('figure'); figure.style.margin = '0';
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    canvas.style.cssText = 'width:256px;height:256px;image-rendering:pixelated;background:#24382f;border:1px solid #687459';
    drawHeroRig(canvas.getContext('2d'), rig, { x: 64, y: 112, time: ms, armAngle: type ? attackPose(type, ms).arm : 0, motion: false });
    const caption = document.createElement('figcaption'); caption.textContent = label;
    figure.append(canvas, caption); document.querySelector('#figures').append(figure);
  }
}
