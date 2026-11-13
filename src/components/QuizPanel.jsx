import { useEffect, useRef, useState } from 'react';
import { cardShortcutIndex, confirmShortcut, cancelShortcut } from '../game/combatShortcuts.js';
import { QUIZ_TYPES, questionById } from '../game/quiz.js';
import { MAX_TERM_LENGTH } from '../game/wordbooks.js';

const INSTRUCTIONS = {
  meaning: '이 단어의 뜻을 고르세요.',
  synonym: '비슷한 뜻의 단어를 고르세요.',
  antonym: '반대 뜻의 단어를 고르세요.',
};

function AnswerVerdict({ correct, review }) {
  return <div className={`answer-verdict ${correct ? 'is-correct' : 'is-wrong'}`} role="status">
    <span aria-hidden="true">{correct ? '✓' : '✕'}</span><strong>{correct ? '정답!' : '오답'}</strong>
    {!review && <small>{correct ? '단어의 힘이 깨어납니다' : '카드 효과는 발동하지 않습니다'}</small>}
  </div>;
}

function TypedAnswer({ busy, onAnswer }) {
  const [answer, setAnswer] = useState('');
  return <form className="quiz-options quiz-typing" onSubmit={(event) => {
    event.preventDefault();
    if (!busy && answer.trim()) onAnswer(answer.trim());
  }}>
    <label htmlFor="typed-answer">영단어 입력</label>
    <input id="typed-answer" value={answer} onChange={(event) => setAnswer(event.target.value)}
      disabled={busy} data-initial-focus lang="en" autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={MAX_TERM_LENGTH} />
    <button type="submit" disabled={busy || !answer.trim()}>정답 확인</button>
  </form>;
}

export default function QuizPanel({ question, feedback, onAnswer, onContinue, cardName, wordbooks, continueLabel = '확인하고 계속', compact = false, busy = false }) {
  const panel = useRef(null);
  const shortcut = useRef(null);
  useEffect(() => () => cancelShortcut(shortcut), []);
  const source = questionById(question.id, wordbooks);
  const typing = question.mode === 'typing';
  useEffect(() => {
    if (!compact || typing || feedback || busy) return;
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
  }, [compact, typing, question, feedback, busy, onAnswer]);
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
  return <section ref={panel} className={`quiz-panel${feedback ? feedback.correct ? ' quiz-correct' : ' quiz-wrong' : ''}`} aria-labelledby="quiz-type quiz-heading">
    {feedback && <AnswerVerdict correct={feedback.correct} review={!compact} />}
    <div className="quiz-content"><div className="quiz-question">
      <p id="quiz-type" className="quiz-type">{typing ? '영단어 입력' : `${QUIZ_TYPES[source.type]} ${source.type === 'meaning' ? '맞히기' : '찾기'}`}</p>
      <h3 id="quiz-heading"><span lang={typing && !feedback ? undefined : 'en'}>{typing && !feedback ? source.word.meaning : source.word.term}</span></h3>
      {(!compact || !feedback) && <p className="quiz-instruction">{typing ? '이 뜻에 해당하는 영단어를 입력하세요.' : INSTRUCTIONS[source.type]}</p>}
      {source.type !== 'meaning' && (!compact || !feedback) && <p className="quiz-context">뜻: {source.word.meaning}</p>}
    </div>
    {!feedback ? typing ? <TypedAnswer key={question.id} busy={busy} onAnswer={onAnswer} /> : <div className="quiz-options" data-keyboard-group>
      {question.options.map((option, i) => <button key={option} disabled={busy} data-initial-focus={i === 0 ? '' : undefined}
        onClick={() => onAnswer(option)}><span>{i + 1}</span>{option}</button>)}
    </div> : <div className="quiz-feedback" aria-live="polite">
      {(!compact || !feedback.correct) && <p><strong>{typing ? '입력한 답' : '선택한 답'}: {feedback.answer}</strong></p>}
      <p>{typing && !feedback.correct ? '정답 예시' : '정답'}: <strong>{typing && feedback.correct ? feedback.answer : source.answers.join(' / ')}</strong></p>
      <p>{source.word.term} — {source.word.meaning}</p>
      {source.bookId ? <p className="game-muted">내 단어장: {source.word.sources[0]}</p> :
        compact ? <details className="quiz-word-details"><summary>유의어·반의어·출처 보기</summary>
        <p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
        <p className="game-muted">출처: {source.word.sources.join(', ')}</p>
      </details> : <><p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
        <p className="game-muted">출처: {source.word.sources.join(', ')}</p></>}
      <button className="game-primary" data-initial-focus disabled={busy} onClick={onContinue}>{continueLabel} <span aria-hidden="true">↵</span></button>
    </div>}
    </div>
    {(cardName || compact) && <footer className="quiz-meta">
      {cardName && <p className="quiz-card-info"><span>사용 카드</span> <strong>{cardName}</strong>{!feedback && <span> · 카드와 에너지 소비 완료</span>}</p>}
      {compact && !feedback && !typing && <p className="quiz-shortcut"><kbd>1</kbd>–<kbd>4</kbd> 같은 숫자 키를 두 번 눌러 확정</p>}
    </footer>}
  </section>;
}
