import { useEffect, useRef, useState } from 'react';
import { cardShortcutIndex, confirmShortcut, cancelShortcut } from '../game/combatShortcuts.js';
import { cardRoleTone } from '../game/cardPreview.js';
import { QUIZ_TYPES, isCorrectAnswer, questionById } from '../game/quiz.js';
import { MAX_TERM_LENGTH } from '../game/wordbooks.js';
import GameIcon from './ui/GameIcon.jsx';

const INSTRUCTIONS = {
  meaning: '이 단어의 뜻을 고르세요.',
  synonym: '비슷한 뜻의 단어를 고르세요.',
  antonym: '반대 뜻의 단어를 고르세요.',
};

function AnswerVerdict({ correct, review }) {
  return <div className={`answer-verdict ${correct ? 'is-correct' : 'is-wrong'}`} role="status">
    <span aria-hidden="true">{correct ? '✓' : '✕'}</span><strong>{correct ? '정답!' : '오답'}</strong>
    {!review && <small>{correct ? '단어의 힘이 깨어납니다' : '카드 효과가 발동하지 않았어요'}</small>}
  </div>;
}

function TypedAnswer({ busy, source, showAnswerHint = false, onAnswer }) {
  const [answer, setAnswer] = useState('');
  const hintAnswer = source?.answers?.[0] ?? source?.word?.term ?? '';
  return <>
    {showAnswerHint && hintAnswer && <div className="admin-typing-hint">
      <span>정답 힌트: <strong lang="en">{hintAnswer}</strong></span>
      <button type="button" disabled={busy} onClick={() => setAnswer(hintAnswer)}>자동 입력</button>
    </div>}
    <form className="quiz-options quiz-typing" onSubmit={(event) => {
      event.preventDefault();
      if (!busy && answer.trim()) onAnswer(answer.trim());
    }}>
      <label htmlFor="typed-answer">영단어 입력</label>
      <input id="typed-answer" value={answer} onChange={(event) => setAnswer(event.target.value)}
        disabled={busy} data-initial-focus lang="en" autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={MAX_TERM_LENGTH} />
      <button type="submit" disabled={busy || !answer.trim()}>정답 확인</button>
    </form>
  </>;
}

export default function QuizPanel({
  question,
  feedback,
  onAnswer,
  onContinue,
  card = null,
  cardName,
  cardSummary = '',
  wordbooks,
  continueLabel = '확인하고 계속',
  compact = false,
  busy = false,
  shortcutMode = 'single',
  showAnswerHint = false,
}) {
  const panel = useRef(null);
  const shortcut = useRef(null);
  useEffect(() => () => cancelShortcut(shortcut), []);
  const source = questionById(question.id, wordbooks);
  const typing = question.mode === 'typing';
  const roleTone = card ? cardRoleTone(card.type) : 'buff';

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
      confirmShortcut(shortcut, `answer:${question.id}:${index}`, button, () => { selected = true; onAnswer(option); }, { mode: shortcutMode });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compact, typing, question, feedback, busy, onAnswer, shortcutMode]);

  useEffect(() => {
    if (!compact || !feedback || busy) return;
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.defaultPrevented ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const root = panel.current;
      const button = root?.querySelector('.quiz-feedback .game-primary');
      if (!button) return;
      const target = event.target;
      if (target instanceof Element && target.closest('summary, input, textarea, select, a')) return;
      if (shortcutMode === 'double' && target !== button) return;
      event.preventDefault();
      confirmShortcut(shortcut, 'continue', button, onContinue, { mode: shortcutMode });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compact, feedback, busy, onContinue, shortcutMode]);

  if (compact && feedback && busy) {
    return <section ref={panel} className="quiz-panel is-battle-focus is-resolving" aria-label="카드 효과 연출 중">
      <AnswerVerdict correct={feedback.correct} />
      <p className="quiz-resolving-note">{cardName} · {feedback.correct ? '기술 발동 중' : '효과 없음'}</p>
    </section>;
  }

  const quizTypeLabel = typing ? '영단어 입력' : `${QUIZ_TYPES[source.type]} ${source.type === 'meaning' ? '맞히기' : '찾기'}`;

  return <section ref={panel}
    className={`quiz-panel${compact ? ' is-battle-focus' : ''}${feedback ? feedback.correct ? ' quiz-correct' : ' quiz-wrong' : ''}`}
    aria-labelledby="quiz-type quiz-heading">
    {compact && (cardName || !feedback) && <header className={`quiz-card-banner tone-${roleTone}`}>
      <div className="quiz-card-badge">
        {card && <span className="quiz-card-icon" aria-hidden="true"><GameIcon name={card.type} /></span>}
        <strong className="quiz-card-title">{cardName}{card?.upgraded ? '+' : ''}</strong>
        {cardSummary && <span className="quiz-card-effect">{cardSummary}</span>}
      </div>
      <span id="quiz-type" className="quiz-type-pill">{quizTypeLabel}</span>
    </header>}

    {feedback && <AnswerVerdict correct={feedback.correct} review={!compact} />}

    <div className="quiz-content">
      <div className="quiz-question">
        {!compact && <p id="quiz-type" className="quiz-type">{quizTypeLabel}</p>}
        <h3 id="quiz-heading"><span lang={typing && !feedback ? undefined : 'en'}>{typing && !feedback ? source.word.meaning : source.word.term}</span></h3>
        {(!compact || !feedback) && <p className="quiz-instruction">{typing ? '이 뜻에 해당하는 영단어를 입력하세요.' : INSTRUCTIONS[source.type]}</p>}
        {source.type !== 'meaning' && (!compact || !feedback) && <p className="quiz-context"><span>뜻</span> {source.word.meaning}</p>}
      </div>

      {!feedback ? (typing ? <TypedAnswer key={question.id} busy={busy} source={source} showAnswerHint={showAnswerHint} onAnswer={onAnswer} /> : <div className="quiz-options" data-keyboard-group>
        {question.options.map((option, i) => {
          const isAdminHint = showAnswerHint && isCorrectAnswer(question, option, wordbooks);
          return <button key={option} className={isAdminHint ? 'is-admin-answer' : undefined} disabled={busy} data-initial-focus={i === 0 ? '' : undefined}
            onClick={() => onAnswer(option)}><span>{i + 1}</span><strong>{option}</strong>{isAdminHint && <em className="admin-answer-pill">정답</em>}</button>;
        })}
      </div>) : <div className="quiz-feedback" aria-live="polite">
        <div className="quiz-feedback-summary">
          {(!compact || !feedback.correct) && <p className="feedback-picked"><span>{typing ? '입력한 답' : '내 선택'}</span> <b>{feedback.answer}</b></p>}
          <p className="feedback-answer"><span>{typing && !feedback.correct ? '정답 예시' : '정답'}</span> <strong>{typing && feedback.correct ? feedback.answer : source.answers.join(' / ')}</strong></p>
          <p className="feedback-pair"><strong lang="en">{source.word.term}</strong> <span>—</span> {source.word.meaning}</p>
        </div>
        {source.bookId ? <p className="game-muted">내 단어장: {source.word.sources[0]}</p> :
          compact ? <details className="quiz-word-details"><summary>유의어·반의어·출처 보기</summary>
            <p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
            <p className="game-muted">출처: {source.word.sources.join(', ')}</p>
          </details> : <><p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
            <p className="game-muted">출처: {source.word.sources.join(', ')}</p></>}
        <button className="game-primary" data-initial-focus disabled={busy} onClick={onContinue}>{continueLabel} <span aria-hidden="true">↵</span></button>
      </div>}
    </div>

    {compact && !feedback && !typing && <footer className="quiz-meta">
      <p className="quiz-shortcut">
        <kbd>1</kbd>–<kbd>4</kbd> {shortcutMode === 'single' ? '숫자 키로 바로 선택' : '같은 숫자 키를 두 번 눌러 확정'}
      </p>
    </footer>}
    {!compact && cardName && <footer className="quiz-meta">
      <p className="quiz-card-info"><span>학습</span> <strong>{cardName}</strong></p>
    </footer>}
  </section>;
}
