import { stages } from '../data/stages.ts';
import { types } from '../data/units.ts';
import type { Battle } from '../game/battle.ts';
import type { Quiz } from '../game/quiz.ts';
import { rules } from '../game/rules.ts';
import { element } from './dom.ts';

export function createView(battle: Battle, quiz: Quiz, answer: (index: number) => void) {
  let questionRevision = -1;
  let reviewSignature = '';

  function overlay(title: string, message: string, label: string) {
    element('overlayTitle').textContent = title;
    element('overlayText').textContent = message;
    element('start').textContent = label;
  }

  function render() {
    const g = battle.state;
    if (questionRevision !== quiz.revision) {
      questionRevision = quiz.revision;
      element('word').textContent = quiz.question[0];
      element('options').replaceChildren();
      quiz.choices.forEach((word, index) => {
        const button = document.createElement('button');
        button.className = 'option';
        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = String(index + 1);
        const label = document.createElement('span');
        label.textContent = word[1];
        button.append(key, label);
        button.addEventListener('click', () => answer(index));
        element('options').append(button);
      });
    }
    Array.from(element('options').children).forEach((node, index) => {
      const button = node as HTMLButtonElement;
      button.disabled = g.mode !== 'running' || quiz.locked;
      button.classList.toggle('correct', quiz.locked && quiz.choices[index][0] === quiz.question[0]);
      button.classList.toggle('wrong', quiz.locked && quiz.selected === index && quiz.choices[index][0] !== quiz.question[0]);
    });

    element('energy').textContent = Math.floor(g.energy) + ' ⚡';
    element('combo').textContent = quiz.combo + ' COMBO';
    element('accuracy').textContent = quiz.attempts ? Math.round(quiz.correct / quiz.attempts * 100) + '%' : '—';
    element('record').textContent = `정답 ${quiz.correct} / ${quiz.attempts}`;
    // Do not repeatedly re-announce the unchanged aria-live feedback on every frame.
    if (element('feedback').textContent !== quiz.feedback) element('feedback').textContent = quiz.feedback;
    element('stageNumber').textContent = `${String(battle.stageIndex + 1).padStart(2, '0')} / ${String(stages.length).padStart(2, '0')}`;
    element('stageName').textContent = battle.stage.name;
    element('baseStatus').textContent = `우리 기지 ${Math.ceil(g.ownHP)} / ${rules.ownBaseHP} · 적 기지 ${Math.ceil(g.enemyHP)} / ${battle.stage.hp}`;
    element('battleTime').textContent = `${String(Math.floor(g.time / 60)).padStart(2, '0')}:${String(Math.floor(g.time % 60)).padStart(2, '0')}`;
    element<HTMLButtonElement>('pause').disabled = !['running', 'paused'].includes(g.mode);
    element('pause').textContent = g.mode === 'paused' ? '계속하기' : '일시정지';
    element<HTMLButtonElement>('hint').disabled = g.mode !== 'running' || quiz.locked || quiz.hinted;
    element<HTMLSelectElement>('level').disabled = g.mode !== 'intro';
    element('overlay').hidden = g.mode === 'running';
    const result = `정답 ${quiz.correct} / ${quiz.attempts} · 정답률 ${quiz.attempts ? Math.round(quiz.correct / quiz.attempts * 100) : 0}%`;
    switch (g.mode) {
      case 'intro':
        overlay('단어로 모으고, 고양이로 지켜요.', '① 단어 뜻을 맞혀 에너지를 모으세요.\n② 아래 버튼으로 유닛을 소환하세요.\n③ 상대 기지를 파괴하면 다음 스테이지!', '첫 전투 시작 →');
        break;
      case 'paused':
        overlay('잠깐, 쉬어가요.', '전투와 퀴즈가 함께 멈췄어요.', '이어서 플레이 →');
        break;
      case 'won':
        overlay('스테이지 클리어! 🐾', result + '\n다음 전투는 에너지와 기지 체력을 회복하고 시작해요.', '다음 스테이지 →');
        break;
      case 'lost':
        overlay('조금만 더! 다시 도전해요.', result + '\n방패로 전선을 지키고 마법 고양이를 보조하세요.', '이 스테이지 재도전 →');
        break;
      case 'complete':
        overlay('모든 기지를 지켰어요! 🏆', result + '\n아래 복습 단어도 확인해보세요.', '새 원정 시작 →');
        break;
    }
    types.forEach((t, index) => {
      const status = battle.summonStatus(index);
      const button = element<HTMLButtonElement>('unit' + index);
      button.disabled = status !== '소환 가능';
      button.title = `${t.name} 고양이 · ${status}`;
      element('status' + index).textContent = status;
      element('cd' + index).style.width = (1 - g.cooldowns[index] / t.cd) * 100 + '%';
    });

    const signature = JSON.stringify([...quiz.mistakes]);
    if (reviewSignature !== signature) {
      reviewSignature = signature;
      element('review').replaceChildren();
      quiz.mistakes.forEach((mistake, word) => {
        const chip = document.createElement('span');
        chip.className = 'review-item';
        chip.textContent = `${word} · ${mistake.meaning}` + (mistake.recovered ? ' ✓ 복습 성공' : ` · 오답 ${mistake.count}회`);
        element('review').append(chip);
      });
    }
  }

  return { render };
}
