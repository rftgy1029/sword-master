import { useEffect, useRef, useState } from 'react';
import { CARDS, MONSTERS } from '../game/catalog.js';
import { gameReducer, intentFor } from '../game/engine.js';
import { questionById } from '../game/quiz.js';
import { heroImage, MONSTER_ROWS, monsterSheet } from '../game/spriteAssets.js';
import { createPracticeBattle } from '../game/tutorial.js';
import { Card, navigateGameButtons } from './AdventureDialog.jsx';
import BattleQuizDock from './BattleQuizDock.jsx';
import { CombatHealthBar } from './CombatIndicators.jsx';
import { useGraphics } from './GraphicsContext.jsx';
import './tutorial.css';

function lessonFor(battle, attack, newAdventure) {
  if (battle.turn > 1) return {
    step: 3, title: '첫 전투 연습 완료!',
    hint: newAdventure ? '지도에서 주황색 방을 고르면 첫 전투가 시작돼요.'
      : '새 턴이 시작됐어요. 실전에서도 적의 다음 행동을 보고 공격과 방어 카드를 골라 보세요.',
  };
  if (battle.feedback?.correct) return {
    step: 3, title: '첫 공격 성공!',
    hint: `적의 체력이 ${battle.effect.amount} 줄었어요. 턴을 끝내면 적이 예고한 행동을 하고 내 에너지가 다시 차요.`,
  };
  if (battle.feedback) return {
    step: 2, title: '다시 한 번 도전해요',
    hint: '틀리면 카드와 에너지를 쓰고 공격은 빗나가요. 뜻을 확인한 뒤 같은 문제를 다시 풀어 보세요.',
  };
  if (battle.pending) return {
    step: 2, title: '단어 퀴즈에 도전!',
    hint: '정답을 고르면 공격이 적중해요.',
  };
  return {
    step: 1, title: '카드를 골라 보세요',
    hint: `‘${attack.name}’을 눌러 보세요. 왼쪽 위의 숫자만큼 에너지를 써요.`,
  };
}

export default function TutorialDialog({ replay, canContinue, onClose }) {
  const dialog = useRef(null);
  const settings = useGraphics();
  const [practice, setPractice] = useState(createPracticeBattle);
  const { deck, battle } = practice.run;
  const { enemy, feedback, pending, turn, energy } = battle;
  const card = deck[0];
  const attack = CARDS[card.type];
  const monster = MONSTERS[enemy.type];
  const sprite = MONSTER_ROWS.indexOf(monster.art);
  const finished = turn > 1;
  const { step, title, hint } = lessonFor(battle, attack, !replay && !canContinue);
  const adventureLabel = canContinue ? '모험 이어하기' : '새 모험 시작';
  const word = feedback && questionById(feedback.question.id).word;

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);
  useEffect(() => {
    dialog.current.querySelector('.tutorial-body').scrollTop = 0;
    dialog.current.querySelector('[data-initial-focus]')?.focus({ preventScroll: true });
  }, [step, feedback, finished]);

  function playCard(current) {
    return gameReducer(current, { type: 'SELECT_CARD', uid: card.uid });
  }

  function answerQuestion(answer) {
    setPractice((current) => gameReducer(current, { type: 'ANSWER', id: pending.question.id, answer }));
  }

  function endTurn() {
    setPractice((current) => gameReducer(gameReducer(current, { type: 'ACK' }), { type: 'END_TURN' }));
  }

  return <dialog ref={dialog} className="game-dialog tutorial-dialog" aria-labelledby="tutorial-title"
    aria-describedby="tutorial-description" onKeyDown={navigateGameButtons}
    onClose={(event) => onClose(event.currentTarget.returnValue === 'adventure')}>
    <header className="tutorial-header">
      <span>첫 전투 튜토리얼</span>
      <button type="button" className="tutorial-skip" onClick={() => dialog.current.close()}>
        {finished || replay ? '닫기' : '건너뛰기'}
      </button>
    </header>
    <div className="tutorial-body">
      <div className="tutorial-stage">
        <div className="tutorial-status"><span>{turn}턴</span><b>에너지 {energy}</b></div>
        <div className="tutorial-enemy"><strong>{monster.name}</strong>
          <CombatHealthBar value={enemy.hp} max={enemy.maxHp} label={`${monster.name} 체력`}
            block={enemy.block} motionPreference={settings.backgroundMotion} />
        </div>
        <div className="tutorial-duel" aria-hidden="true">
          <img src={heroImage} alt="" />
          <span style={{ backgroundImage: `url("${monsterSheet}")`, backgroundPosition: `${(sprite % 4) * 100 / 3}% ${Math.floor(sprite / 4) * 50}%` }} />
          {feedback?.correct && <b className="tutorial-damage">−{battle.effect.amount}</b>}
        </div>
      </div>
      <section className="tutorial-lesson" aria-labelledby="tutorial-title">
        <ol className="tutorial-progress" aria-label={`3단계 중 ${step}단계`}>
          {['카드 선택', '단어 퀴즈', '턴 종료'].map((label, i) => <li key={label}
            aria-current={i + 1 === step ? 'step' : undefined}>{label}</li>)}
        </ol>
        <h2 id="tutorial-title" aria-live="polite">{title}</h2>
        {step === 1 ? <div className="tutorial-hand">
          <Card card={card} compact initialFocus actionLabel="카드 선택" onClick={() => setPractice(playCard)} />
          <div><p id="tutorial-description">{hint}</p><small>연습 결과는 학습 기록에 남지 않아요.</small></div>
        </div> : <p id="tutorial-description">{hint}</p>}
        {pending && <BattleQuizDock question={pending.question} card={card} cardName={attack.name}
          shortcutMode={settings.shortcutConfirm} onAnswer={answerQuestion} />}
        {feedback && <p className="tutorial-word" role="status"><strong lang="en">{word.term}</strong> {word.meaning}</p>}
        {feedback?.correct && <>
          <p className="tutorial-intent">적의 다음 행동 · {intentFor(enemy).label}</p>
          <button className="game-primary" data-initial-focus onClick={endTurn}>턴 종료</button>
        </>}
        {feedback && !feedback.correct && <button className="game-primary" data-initial-focus
          onClick={() => setPractice(playCard(createPracticeBattle()))}>같은 문제 다시 풀기</button>}
        {finished && <button className="game-primary" data-initial-focus
          onClick={() => dialog.current.close(replay ? '' : 'adventure')}>{replay ? '설정으로 돌아가기' : adventureLabel}</button>}
      </section>
    </div>
  </dialog>;
}
