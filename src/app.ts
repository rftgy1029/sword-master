import { Battle } from './game/battle.ts';
import { Quiz } from './game/quiz.ts';
import { createRenderer } from './game/renderer.ts';
import { createView } from './ui/view.ts';
import { element } from './ui/dom.ts';
import { types } from './data/units.ts';

/** Connects independent gameplay systems to browser events and the animation loop. */
export function startApp() {
  const battle = new Battle();
  const quiz = new Quiz();
  const canvas = element<HTMLCanvasElement>('field');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 Canvas 2D를 사용할 수 없습니다.');
  const renderer = createRenderer(ctx);
  const events = new AbortController();
  const options = { signal: events.signal };
  const view = createView(battle, quiz, answer);
  let lastTime = performance.now();
  let uiClock = 0;
  let frameId = 0;

  function answer(index: number) {
    if (battle.state.mode !== 'running') return;
    const reward = quiz.answer(index);
    if (reward !== null) battle.addEnergy(reward);
    view.render();
  }

  function reset() {
    battle.setupStage(0, 'intro');
    quiz.reset();
    quiz.feedback = '전투를 시작하면 보급 퀴즈가 열려요.';
    view.render();
  }

  function primaryAction() {
    const { mode } = battle.state;
    if (mode === 'paused') battle.togglePause();
    else if (mode === 'complete') {
      reset();
      battle.setupStage(0);
      quiz.next();
    } else if (mode === 'intro' || mode === 'won' || mode === 'lost') {
      battle.setupStage(battle.stageIndex + (mode === 'won' ? 1 : 0));
      quiz.next();
    }
    view.render();
  }

  function togglePause() {
    battle.togglePause();
    view.render();
  }

  function summon(index: number) {
    battle.summon(index);
    view.render();
  }

  function showHint() {
    if (battle.state.mode !== 'running') return;
    quiz.showHint();
    view.render();
  }

  function frame(now: number) {
    const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (battle.state.mode === 'running') {
      quiz.update(dt);
      battle.update(dt);
      if (battle.state.mode !== 'running') {
        quiz.combo = 0;
        view.render();
      }
    }
    uiClock += dt;
    if (uiClock > .1) {
      view.render();
      uiClock = 0;
    }
    renderer.draw(battle.state, battle.stage, battle.stageIndex);
    frameId = requestAnimationFrame(frame);
  }

  element('start').addEventListener('click', primaryAction, options);
  element('pause').addEventListener('click', togglePause, options);
  element('restart').addEventListener('click', reset, options);
  element('hint').addEventListener('click', showHint, options);
  element<HTMLSelectElement>('level').addEventListener('change', event => {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (battle.state.mode === 'intro' && (value === 'basic' || value === 'intermediate')) {
      quiz.setDifficulty(value);
      view.render();
    }
  }, options);
  types.forEach((_, index) => element('unit' + index).addEventListener('click', () => summon(index), options));

  document.addEventListener('keydown', event => {
    const active = document.activeElement;
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
      active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))) return;
    const key = event.key.toLowerCase();
    if (['1', '2', '3', '4'].includes(key)) {
      event.preventDefault();
      answer(Number(key) - 1);
    } else if (['q', 'w', 'e'].includes(key)) {
      event.preventDefault();
      summon(['q', 'w', 'e'].indexOf(key));
    } else if (key === 'p') {
      event.preventDefault();
      togglePause();
    }
  }, options);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && battle.state.mode === 'running') togglePause();
  }, options);

  quiz.feedback = '전투를 시작하면 보급 퀴즈가 열려요.';
  view.render();
  renderer.draw(battle.state, battle.stage, battle.stageIndex);
  frameId = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(frameId);
    events.abort();
  };
}
