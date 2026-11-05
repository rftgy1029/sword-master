import { useEffect, useRef } from 'react';
import { hero } from '../scene.js';
import { MONSTERS } from '../game/catalog.js';

function monster(ctx, art) {
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  if (art === 'crawler') {
    rect(2, 25, 34, 15, '#465540'); rect(6, 20, 25, 12, '#63704c');
    rect(0, 32, 8, 5, '#859062'); rect(32, 32, 8, 5, '#859062');
    for (const x of [4, 14, 26, 32]) rect(x, 40, 4, 7, '#858267');
    rect(7, 30, 4, 3, '#dfb975'); rect(24, 30, 4, 3, '#dfb975');
    rect(12, 38, 13, 2, '#202b26'); rect(17, 21, 4, 5, '#98a169');
  } else if (art === 'ember') {
    rect(8, 16, 23, 27, '#65554c'); rect(4, 26, 31, 12, '#4b4840');
    rect(11, 8, 17, 12, '#8b6e4b'); rect(14, 11, 12, 9, '#1c2726');
    rect(16, 15, 3, 2, '#e6b56c'); rect(23, 15, 3, 2, '#e6b56c');
    rect(16, 25, 7, 10, '#d49c55'); rect(18, 23, 3, 9, '#f0d997');
    for (const x of [7, 15, 26]) rect(x, 42, 4, 4, '#7a6250');
  } else {
    const boss = art === 'boss';
    rect(7, 12, 27, 29, boss ? '#756548' : '#666d5a');
    rect(3, 17, 8, 20, '#414e45'); rect(30, 17, 8, 20, '#414e45');
    rect(10, 2, 20, 15, '#85866b'); rect(12, 6, 16, 8, '#293632');
    rect(13, 8, 5, 2, '#dbba75'); rect(23, 8, 4, 2, '#dbba75');
    rect(14, 19, 12, 3, '#a79a65'); rect(18, 22, 4, 12, '#4a5143');
    rect(9, 40, 8, 8, '#3c463e'); rect(24, 40, 8, 8, '#3c463e');
    rect(35, 8, 3, 27, '#a4a78b'); rect(32, 33, 10, 3, '#a78c55');
    if (boss) {
      rect(8, -4, 4, 10, '#b49b5c'); rect(28, -4, 4, 10, '#b49b5c');
      rect(17, -6, 7, 10, '#c6a768'); rect(18, -3, 4, 4, '#e4cc8b');
      rect(0, 22, 4, 18, '#805b48'); rect(36, 22, 4, 18, '#805b48');
    }
  }
}

export default function CombatScene({ enemy, effect }) {
  const canvas = useRef(null);
  const art = MONSTERS[enemy.type].art;
  useEffect(() => {
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 480, 160);
    const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
    rect(0, 0, 480, 160, '#17201e');
    for (let row = 0; row < 5; row++) for (let col = 0; col < 13; col++) {
      rect(col * 40 - (row % 2) * 20, row * 26, 38, 24, (row + col) % 3 ? '#25302b' : '#2a342d');
    }
    for (const x of [20, 220, 440]) {
      rect(x, 0, 20, 134, '#323d32'); rect(x + 2, 0, 3, 134, '#48513c');
    }
    rect(0, 132, 480, 28, '#30382a');
    for (let i = 0; i < 12; i++) rect(i * 44, 143, 42, 2, '#404732');
    for (const x of [55, 413]) {
      rect(x, 54, 5, 15, '#756444'); rect(x - 2, 46, 9, 9, '#b98149');
      rect(x, 43, 5, 10, '#e4b466'); rect(x + 1, 49, 3, 6, '#f1d899');
    }
    rect(84, 134, 52, 4, '#18231e'); rect(332, 134, 67, 4, '#18231e');
    ctx.save(); ctx.translate(-25, -97); hero(ctx, 0); ctx.restore();
    ctx.save(); ctx.translate(331, art === 'boss' ? 28 : 38); ctx.scale(2, 2); monster(ctx, art); ctx.restore();
  }, [art, effect.id]);

  return <div key={effect.id} className={`combat-scene effect-${effect.kind}`}>
    <canvas ref={canvas} width="480" height="160" aria-hidden="true" />
    {effect.amount > 0 && <span className="combat-number" aria-hidden="true">{['attack', 'hurt'].includes(effect.kind) ? '−' : '+'}{effect.amount}</span>}
    <span className="scene-vignette" aria-hidden="true" />
  </div>;
}
