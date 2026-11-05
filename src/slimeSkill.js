export const SKILL_DURATION = { decode: 1200, guard: 900, finish: 2000 };

// One clock seeks every animation and dispatches sound cues. Hidden tabs cannot
// advance a second timer while the character is paused.
export function playSlimeSkill(root, { type, limited = false, audio, soundEnabled, onComplete, onImpact,
  now = () => performance.now(), requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame }) {
  const animations = [];
  const duration = limited ? 160 : SKILL_DURATION[type];
  const lead = type === 'finish' ? 800 : 0;
  const hit = type === 'guard' ? 380 : lead + 500;
  const cues = limited ? [[0, type === 'guard' ? 'guard' : type === 'finish' ? 'finish' : 'hit']]
    : type === 'guard' ? [[hit, 'guard']] : [[lead + 300, 'swing'], [hit, type === 'finish' ? 'finish' : 'hit']];
  const fired = new Set();
  let elapsed = 0, previous = now(), frame, paused = false, ended = false, impacted = false;
  const label = root.querySelector('.skill-phase-label');
  function animate(selector, frames, start = 0, length = duration) {
    if (limited) return;
    for (const element of root.querySelectorAll(selector)) {
      const animation = element.animate(frames, { duration: length, delay: start, fill: 'both', easing: 'linear' });
      animation.pause(); animation.currentTime = 0;
      animations.push(animation);
    }
  }
  if (type === 'guard') {
    animate('.skill-mover', [
      { transform: 'translate(0, 0)', offset: 0 }, { transform: 'translate(-13px, 2px)', offset: .35 },
      { transform: 'translate(-13px, 2px)', offset: .5 }, { transform: 'translate(0, 0)', offset: 1 },
    ]);
    animate('.skill-mover .hero-arm', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-70deg)', offset: .3 }, { transform: 'rotate(-70deg)', offset: .65 }, { transform: 'rotate(0deg)' }]);
    animate('.enemy-slime', [{ transform: 'translate(0, 0) scale(1)' }, { transform: 'translate(-177px, -9px) scale(.9, 1.1)', offset: .42 }, { transform: 'translate(-177px, -9px) scale(.9, 1.1)', offset: .5 }, { transform: 'translate(0, 0) scale(1)' }]);
    animate('.skill-shield', [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)', offset: .2 }, { opacity: 0, transform: 'scale(1.15)' }], 290, 450);
  } else {
    animate('.skill-mover', [
      { transform: 'translate(0, 0)', offset: 0 }, { transform: 'translate(-10px, 4px)', offset: .25 },
      { transform: 'translate(206px, -2px)', offset: .4167 }, { transform: 'translate(206px, -2px)', offset: .475 },
      { transform: 'translate(212px, 2px)', offset: .625 }, { transform: 'translate(0, 0)', offset: 1 },
    ], lead, 1200);
    animate('.skill-mover .hero-arm', [
      { transform: 'rotate(0deg)', offset: 0 }, { transform: 'rotate(-110deg)', offset: .25 },
      { transform: 'rotate(60deg)', offset: .4167 }, { transform: 'rotate(60deg)', offset: .475 },
      { transform: 'rotate(75deg)', offset: .625 }, { transform: 'rotate(0deg)', offset: 1 },
    ], lead, 1200);
    animate('.skill-mover .hero-torso', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)', offset: .25 }, { transform: 'rotate(9deg)', offset: .4167 }, { transform: 'rotate(9deg)', offset: .475 }, { transform: 'rotate(0deg)' }], lead, 1200);
    animate('.skill-mover .hero-cape', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(28deg)', offset: .4 }, { transform: 'rotate(28deg)', offset: .475 }, { transform: 'rotate(-8deg)', offset: .75 }, { transform: 'rotate(0deg)' }], lead, 1200);
    animate('.skill-mover .hero-legs', [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-16deg)', offset: .3 }, { transform: 'rotate(13deg)', offset: .42 }, { transform: 'rotate(13deg)', offset: .475 }, { transform: 'rotate(0deg)' }], lead, 1200);
    animate('.skill-charge', [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)', offset: .65 }, { opacity: 0, transform: 'scale(1.15)' }], lead, 500);
    animate('.skill-trails', [{ opacity: 0 }, { opacity: .5, offset: .3 }, { opacity: 0 }], lead + 280, 310);
    // The repeated hit poses hold both participants for 70ms at contact.
    animate('.enemy-slime', [
      { transform: 'translate(0, 0) scale(1)', filter: 'brightness(1)', opacity: 1, offset: 0 },
      { transform: 'translate(0, 0) scale(1)', filter: 'brightness(1)', opacity: 1, offset: .4167 },
      { transform: 'translate(8px, 3px) scale(1.18, .68)', filter: 'brightness(1.65)', opacity: 1, offset: .42 },
      { transform: 'translate(8px, 3px) scale(1.18, .68)', filter: 'brightness(1.65)', opacity: 1, offset: .4783 },
      { transform: `translate(${type === 'finish' ? 52 : 25}px, -8px) scale(.92, 1.06)`, filter: 'brightness(1)', opacity: 1, offset: .7 },
      { transform: type === 'finish' ? 'translate(65px, 16px) scale(.25, .1)' : 'translate(0, 0) scale(1)', filter: 'brightness(1)', opacity: type === 'finish' ? 0 : 1, offset: 1 },
    ], lead, 1200);
    animate('.skill-arc', [{ opacity: 0, transform: 'scale(.25) rotate(-18deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: .15 }, { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: .36 }, { opacity: 0, transform: 'scale(1.1) rotate(7deg)' }], hit - 35, 330);
    animate('.skill-impact', [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1)', offset: .05 }, { opacity: 1, transform: 'scale(1)', offset: .28 }, { opacity: 0, transform: 'scale(1.5)' }], hit, 320);
    animate('.corridor-panorama', [{ transform: 'translate(0,0)' }, { transform: 'translate(-3px,1px)', offset: .2 }, { transform: 'translate(3px,-1px)', offset: .4 }, { transform: 'translate(-1px,0)', offset: .65 }, { transform: 'translate(0,0)' }], hit + 70, 150);
    if (type === 'finish') {
      animate('.skill-cutin', [{ opacity: 0, transform: 'translateX(-10%)' }, { opacity: 1, transform: 'translateX(0)', offset: .14 }, { opacity: 1, transform: 'translateX(0)', offset: .83 }, { opacity: 0, transform: 'translateX(8%)' }], 0, lead);
      animate('.skill-vignette', [{ opacity: 0 }, { opacity: .8, offset: .2 }, { opacity: .8, offset: .7 }, { opacity: 0 }]);
    }
  }
  function paint() {
    for (const animation of animations) animation.currentTime = elapsed;
    const phase = limited ? '뜻 해독 완료' : elapsed >= duration ? type === 'guard' ? '방어 성공' : type === 'finish' ? '해독검 적중' : '검격 적중' : type === 'guard' ? '공격을 막아냈다' : elapsed < lead ? '해독검' : elapsed < lead + 300 ? '검에 뜻을 새긴다' : elapsed < hit ? '빈틈을 향해 돌진' : elapsed < hit + 250 ? '명령을 베어낸다' : '자세를 되돌린다';
    root.dataset.skillPhase = phase;
    if (label) label.textContent = phase;
    if (!impacted && elapsed >= (limited ? 0 : hit)) { impacted = true; onImpact?.(); }
    cues.forEach(([at, kind], index) => {
      if (elapsed >= at && !fired.has(index)) { fired.add(index); audio?.play(kind, soundEnabled); }
    });
  }
  function tick() {
    if (ended || paused) return;
    const current = now(); elapsed = Math.min(duration, elapsed + current - previous); previous = current;
    paint();
    if (elapsed >= duration) { ended = true; onComplete(); }
    else frame = requestFrame(tick);
  }
  frame = requestFrame(tick);
  return {
    pause() { if (ended || paused) return; elapsed = Math.min(duration, elapsed + now() - previous); paused = true; cancelFrame(frame); audio?.stop(); },
    resume() { if (ended || !paused) return; paused = false; previous = now(); frame = requestFrame(tick); },
    cancel() { ended = true; cancelFrame(frame); animations.forEach((animation) => animation.cancel()); audio?.stop(); delete root.dataset.skillPhase; },
  };
}
