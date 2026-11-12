import { useEffect, useRef } from 'react';
import { cardShortcutIndex, confirmShortcut, cancelShortcut } from '../game/combatShortcuts.js';
import { QUIZ_TYPES, questionById } from '../game/quiz.js';

function AnswerVerdict({ correct }) {
  return <div className={`answer-verdict ${correct ? 'is-correct' : 'is-wrong'}`} role="status">
    <span aria-hidden="true">{correct ? '✓' : '✕'}</span><strong>{correct ? '정답!' : '오답'}</strong><small>{correct ? '단어의 힘이 깨어납니다' : '카드 효과는 발동하지 않습니다'}</small>
  </div>;
}

export default function QuizPanel({ question, feedback, onAnswer, onContinue, cardName, compact = false, busy = false }) {
  const panel = useRef(null);
  const shortcut = useRef(null);
  useEffect(() => () => cancelShortcut(shortcut), []);
  const source = questionById(question.id);
  useEffect(() => {
    if (!compact || feedback || busy) return;
    let selected = false;
    const onKeyDown = (event) => {
      const index = cardShortcutIndex(event);
      if (index === null || selected || document.hidden) return;
      const target = event.target;
      const root = panel.current;
      if (!root || !(root.contains(target) || target === root.closest('dialog') || target === document.body)) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const option = question.options[index];
      if (option === undefined) return;
      event.preventDefault();
      const button = root.querySelectorAll('.quiz-options button')[index];
      confirmShortcut(shortcut, `answer:${question.id}:${index}`, button, () => { selected = true; onAnswer(option); });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compact, question, feedback, busy, onAnswer]);
  useEffect(() => {
    if (!compact || !feedback || busy) return;
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.defaultPrevented ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const button = panel.current?.querySelector('.quiz-feedback .game-primary');
      if (!button || event.target !== button) return;
      event.preventDefault();
      confirmShortcut(shortcut, 'continue', button, onContinue);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compact, feedback, busy, onContinue]);
  if (compact && feedback && busy) return <section ref={panel} className="quiz-panel is-resolving" aria-label="카드 효과 연출 중">
    <AnswerVerdict correct={feedback.correct} /><p>{cardName} · {feedback.correct ? '기술 연출 중' : '효과 없음'}</p>
  </section>;
  return <section ref={panel} className={`quiz-panel${feedback ? feedback.correct ? ' quiz-correct' : ' quiz-wrong' : ''}`} aria-labelledby="quiz-heading">
    {feedback && <AnswerVerdict correct={feedback.correct} />}
    <div className="quiz-heading-row">
      <p className="game-eyebrow">{feedback ? feedback.correct ? '정답 · 효과 발동' : '오답 · 효과 없음' : `${QUIZ_TYPES[source.type]} 문제`}</p>
      <span>{cardName}{!feedback && ' · 카드와 에너지 소비 완료'}{compact && !feedback && ' · 숫자 키 두 번으로 확정'}</span>
    </div>
    <h3 id="quiz-heading"><span lang="en">{source.word.term}</span>{(!compact || !feedback) && <small>{source.type === 'meaning' ? '이 단어의 뜻은?' : `아래 뜻에서의 ${QUIZ_TYPES[source.type]}는?`}</small>}</h3>
    {source.type !== 'meaning' && (!compact || !feedback) && <p className="quiz-context">뜻: {source.word.meaning}</p>}
    {!feedback ? <div className="quiz-options" data-keyboard-group>
      {question.options.map((option, i) => <button key={option} disabled={busy} data-initial-focus={i === 0 ? '' : undefined}
        onClick={() => onAnswer(option)}><span>{i + 1}</span>{option}</button>)}
    </div> : <div className="quiz-feedback" aria-live="polite">
      {(!compact || !feedback.correct) && <p><strong>{feedback.correct ? '정답이에요.' : `선택한 답: ${feedback.answer}`}</strong></p>}
      <p>정답: <strong>{source.answers.join(' / ')}</strong></p>
      <p>{source.word.term} — {source.word.meaning}</p>
      {compact ? <details className="quiz-word-details"><summary>유의어·반의어·출처 보기</summary>
        <p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
        <p className="game-muted">출처: {source.word.sources.join(', ')}</p>
      </details> : <><p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
        <p className="game-muted">출처: {source.word.sources.join(', ')}{!feedback.correct && ' · 약점 복습에 기록했습니다. 같은 카드 사용은 다시 시도할 수 없어요.'}</p></>}
      <button className="game-primary" data-initial-focus disabled={busy} onClick={onContinue}>확인하고 계속 <span aria-hidden="true">↵</span></button>
    </div>}
  </section>;
}
