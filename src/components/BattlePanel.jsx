import { useEffect, useId, useRef, useState } from 'react';
import { createEncounter, encounterAction, ENCOUNTERS, makeQuestion, recordAnswer } from '../battle.js';

export default function BattlePanel({ id, learning, onLearning, onComplete, onVisual, onPause, autoPlaying, suspended, audio, soundEnabled, skillDone, limitedMotion }) {
  const encounter = ENCOUNTERS.find((item) => item.id === id);
  const puzzle = encounter.mode === 'puzzle';
  const [session, setSession] = useState(() => learning.encounters[id] ?? createEncounter(id, learning));
  const [feedback, setFeedback] = useState(null);
  const [watching, setWatching] = useState(false);
  const [watchStep, setWatchStep] = useState(0);
  const [skill, setSkill] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const serial = useRef(0);
  const instance = useId();
  const advancing = useRef(false);
  const heading = useRef(null);
  const locked = useRef(false);
  const complete = session.answers.length === session.wordIds.length && feedback === null && !finishing && !watching;
  const skillBusy = skill !== null && skillDone !== skill.token;
  const index = feedback ? session.answers.length - 1 : session.answers.length;
  const question = complete ? null : makeQuestion(id, session.wordIds[index], index);
  const correctCount = session.answers.reduce((sum, choice, i) => sum + (choice === makeQuestion(id, session.wordIds[i], i).answerIndex ? 1 : 0), 0);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest('.story-frame')?.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    const phase = watching ? 'correct' : feedback ? feedback.correct ? 'correct' : 'incorrect' : complete ? 'complete' : 'ready';
    onVisual({ kind: encounter.kind, mode: encounter.mode, action: id === 'slime' ? complete ? 'cleared' : skill ? 'skill' : 'ready' : encounterAction(encounter, phase), skill, token: `${id}-${session.answers.length}-${watchStep}`, remaining: session.wordIds.length - session.answers.length });
    return () => onVisual(null);
  }, [id, encounter, session.answers.length, feedback, watching, watchStep, complete, onVisual, skill]);

  function requestSkill(type) {
    setSkill({ type, token: `${instance}-${++serial.current}` });
  }
  useEffect(() => {
    if (finishing && !skillBusy) { setFinishing(false); setSkill(null); }
  }, [finishing, skillBusy]);

  function answer(choice) {
    if (locked.current || suspended || watching || complete || finishing || feedback !== null) return;
    locked.current = true;
    advancing.current = false;
    const updated = recordAnswer(learning, id, session, index, choice);
    const next = updated.encounters[id];
    setSession(next);
    setFeedback({ choice, correct: choice === question.answerIndex });
    onLearning(updated);
    if (id === 'slime') { audio.unlock(soundEnabled); requestSkill(choice === question.answerIndex ? 'decode' : 'guard'); }
  }

  function nextQuestion() {
    if (suspended || !feedback || advancing.current) return;
    advancing.current = true;
    locked.current = false;
    setFeedback(null);
    if (id === 'slime' && session.answers.length === session.wordIds.length) {
      setFinishing(true); requestSkill('finish');
    } else setSkill(null);
    heading.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (suspended || !autoPlaying || !feedback || skillBusy) return;
    const timer = setTimeout(nextQuestion, feedback.correct ? 2200 : 4500);
    return () => clearTimeout(timer);
  }, [suspended, autoPlaying, feedback, skillBusy]);
  useEffect(() => {
    if (suspended || !autoPlaying || !complete || watching) return;
    const timer = setTimeout(onComplete, 5500);
    return () => clearTimeout(timer);
  }, [suspended, autoPlaying, complete, watching, onComplete]);
  useEffect(() => {
    if (!watching || suspended || !autoPlaying || skillBusy) return;
    const timer = setTimeout(() => {
      if (watchStep >= 2) onComplete();
      else { setWatchStep((step) => step + 1); if (id === 'slime') requestSkill(watchStep === 0 ? 'guard' : 'finish'); }
    }, id === 'slime' && limitedMotion ? 250 : 1800);
    return () => clearTimeout(timer);
  }, [watching, watchStep, suspended, autoPlaying, onComplete, skillBusy, id, limitedMotion]);
  useEffect(() => {
    function keydown(event) {
      if (suspended || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input, select, textarea')) return;
      if (/^[1-4]$/.test(event.key) && !feedback && !complete && !watching && !finishing) { event.preventDefault(); answer(Number(event.key) - 1); }
      if (['Enter', ' '].includes(event.key) && !event.target.closest('button, a')) {
        if (finishing) { event.preventDefault(); setSkill(null); setFinishing(false); }
        else if (feedback) { event.preventDefault(); nextQuestion(); }
        else if (complete || watching) { event.preventDefault(); onComplete(); }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });

  function replay() {
    setSession(createEncounter(id, learning));
    setFeedback(null);
    locked.current = false;
    advancing.current = false;
    setFinishing(false); setSkill(null);
  }

  return (
    <section className={`battle-panel${puzzle ? ' puzzle-panel' : ''}${feedback ? feedback.correct ? ' is-correct' : ' is-incorrect' : ''}`} aria-label={puzzle ? '단어 마법 퍼즐' : '단어 마법 전투'}>
      <div className="battle-heading"><div><p className="battle-eyebrow">WORD MAGIC <span>/</span> {puzzle ? 'EXPLORATION PUZZLE' : encounter.kind === 'boss' ? 'BOSS BATTLE' : 'ENCOUNTER'}</p><h2 ref={heading} tabIndex={-1}>{encounter.title}</h2></div>
        <span className="battle-counter">{session.answers.length}<span> / {session.wordIds.length}</span></span></div>
      <div className="battle-shield" role="progressbar" aria-label="해제한 마법 명령" aria-valuenow={session.answers.length} aria-valuemin={0} aria-valuemax={session.wordIds.length}>
        {session.wordIds.map((wordId, i) => <span key={wordId} className={i < session.answers.length ? 'is-cleared' : ''} />)}</div>
      {finishing ? <div className="battle-finishing" role="status"><p>네 개의 주문을 하나로 잇습니다.</p><h3>해독검 · 종결</h3><button className="story-text-button" disabled={suspended} onClick={() => { setSkill(null); setFinishing(false); }}>연출 건너뛰고 결과 보기 →</button></div>
        : watching ? <div className="battle-watch" role="status"><p className="battle-watch-magic">✦</p><h3>{[...(encounter.watchLines ?? (puzzle ? ['빛을 비춰 흐려진 문구를 읽습니다.', '뜻에 맞는 명령을 연결해 장치를 복원합니다.'] : ['용사의 검에 해독의 빛이 모입니다.', '모모가 공격을 피하고, 니아가 방어막을 펼칩니다.'])), encounter.success][watchStep]}</h3><p>{puzzle ? '복원' : '전투'} 연출을 감상 중이에요. 단어 응답 기록은 남기지 않아요.</p><button className="story-next-button" onClick={onComplete}>이야기 계속 →</button></div>
        : complete ? <div className="battle-result"><p className="battle-result-mark" aria-hidden="true">✦</p><h3>{puzzle ? id === 'signs' ? '길 안내 복원 완료' : '장치 복원 완료' : id === 'slime' ? '통로 확보' : '명령 해제 완료'}</h3><p>{encounter.success}</p>
          <p className="battle-result-score">정답 <strong>{correctCount}</strong> / {session.wordIds.length} <span>모든 명령의 뜻을 확인했어요.</span></p>
          {correctCount < session.wordIds.length && <details onToggle={(event) => { if (event.currentTarget.open) onPause(); }}><summary>이번 구간의 오답 확인</summary><ul>{session.answers.map((choice, i) => {
            const item = makeQuestion(id, session.wordIds[i], i);
            return choice !== item.answerIndex && <li key={i}><strong>{item.term}</strong><span>{item.answer}</span></li>;
          })}</ul></details>}
          <div className="battle-result-actions"><button className="story-text-button" onClick={replay}>다시 도전</button><button className="story-next-button" onClick={onComplete}>이야기 계속 →</button></div></div>
          : <>
            <p className="battle-objective">{encounter.objective}</p>
            <div className="battle-question"><div><span className="battle-question-type">{question.type === 'meaning' ? '뜻 해독' : question.type === 'synonyms' ? '유의어 연결' : '반의어 해제'}</span><h3 lang="en">{question.term}</h3></div><p>{question.type === 'meaning' && encounter.questionPrompt ? encounter.questionPrompt : question.prompt}{question.type !== 'meaning' && <small>단어의 뜻: {question.word.meaning}</small>}</p></div>
            <div className="battle-options" role="group" aria-label="명령의 정답 선택">{question.options.map((option, i) => <button key={option} disabled={feedback !== null || suspended} onClick={() => answer(i)} className={`${feedback && i === question.answerIndex ? 'is-answer' : ''}${feedback && i === feedback.choice && !feedback.correct ? ' is-wrong' : ''}`}><kbd>{i + 1}</kbd><span>{option}</span>{feedback && i === question.answerIndex && <span aria-label="정답">✓</span>}</button>)}</div>
            {feedback && <div className="battle-feedback" role="status"><strong>{feedback.correct ? encounter.correctFeedback ?? (puzzle ? '뜻이 맞았어요. 장치의 문구가 제자리를 찾습니다.' : '명령 해독! 검에 빛이 실립니다.') : encounter.incorrectFeedback ?? (puzzle ? '뜻을 확인하고 연결을 다시 맞춰 봐요.' : '니아가 방어했어요. 정답을 확인하고 다시 나아가요.')}</strong><p><span lang="en">{question.term}</span> · {question.word.meaning}{question.type !== 'meaning' && <> / {question.type === 'synonyms' ? '유의어' : '반의어'}: {question.answer}</>}</p><button className="story-text-button" onClick={nextQuestion}>{session.answers.length === session.wordIds.length ? '결과 보기' : '다음 문제'} →</button></div>}
          </>}
      {!watching && !complete && !finishing && <div className="battle-bottom"><span>시간 제한 없이 <kbd>1</kbd>~<kbd>4</kbd> 또는 선택지 클릭</span><button className="story-text-button" disabled={suspended} onClick={() => { setWatching(true); setFeedback(null); if (id === 'slime') { audio.unlock(soundEnabled); requestSkill('decode'); } }}>{puzzle ? '복원' : '전투'} 연출만 보기 »</button></div>}
    </section>
  );
}
