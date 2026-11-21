import { useEffect, useRef, useState } from 'react';
import { cardShortcutIndex, confirmShortcut, cancelShortcut } from '../game/combatShortcuts.js';
import { cardRoleTone } from '../game/cardPreview.js';
import { QUIZ_TYPES, isCorrectAnswer, questionById } from '../game/quiz.js';
import { MAX_TERM_LENGTH } from '../game/wordbooks.js';
import GameIcon from './ui/GameIcon.jsx';

const TASK_META = {
  meaning: { tone: 'meaning', symbol: '✦', title: '뜻 맞히기', prompt: '이 단어의 뜻을 고르세요' },
  synonym: { tone: 'synonym', symbol: '≈', title: '유의어 찾기', prompt: '비슷한 뜻의 단어를 고르세요' },
  antonym: { tone: 'antonym', symbol: '≠', title: '반의어 찾기', prompt: '반대 뜻의 단어를 고르세요' },
  typing: { tone: 'typing', symbol: '⌨', title: '영단어 입력', prompt: '이 뜻의 영단어를 입력하세요' },
};

function DockTypedAnswer({ busy, feedback, source, showAnswerHint = false, onAnswer, onSkipReveal }) {
  const [value, setValue] = useState('');
  if (feedback) {
    return <div className={`quiz-dock-typing-reveal ${feedback.correct ? 'is-correct' : 'is-wrong'}`}
      onClick={!feedback.correct ? onSkipReveal : undefined}>
      <span className="quiz-dock-reveal-mark" aria-hidden="true">{feedback.correct ? '✓' : '✕'}</span>
      {feedback.correct ? (
        <p><strong lang="en">{source.word.term}</strong> — {source.word.meaning}</p>
      ) : (
        <p><span>입력: {feedback.answer}</span> · <strong>정답: {source.answers.join(' / ')}</strong></p>
      )}
    </div>;
  }
  const hintAnswer = source.answers[0] ?? source.word.term;
  return <>
    {showAnswerHint && <div className="admin-typing-hint">
      <span>정답 힌트: <strong lang="en">{hintAnswer}</strong></span>
      <button type="button" disabled={busy} onClick={() => setValue(hintAnswer)}>자동 입력</button>
    </div>}
    <form className="quiz-options quiz-typing quiz-dock-typing" onSubmit={(event) => {
      event.preventDefault();
      if (!busy && value.trim()) onAnswer(value.trim());
    }}>
      <label htmlFor="battle-typed-answer" className="sr-only">영단어 입력</label>
      <input id="battle-typed-answer" value={value} onChange={(event) => setValue(event.target.value)}
        placeholder="이 뜻의 영단어를 입력하세요"
        disabled={busy} data-initial-focus lang="en" autoCapitalize="none" autoComplete="off" spellCheck={false} maxLength={MAX_TERM_LENGTH} />
      <button type="submit" className="game-primary" disabled={busy || !value.trim()}>발동</button>
    </form>
  </>;
}

export default function BattleQuizDock({
  question,
  feedback = null,
  card = null,
  cardName = '',
  cardSummary = '',
  wordbooks,
  busy = false,
  shortcutMode = 'single',
  revealDuration = 0,
  showAnswerHint = false,
  onAnswer,
  onSkipReveal,
}) {
  const rootRef = useRef(null);
  const shortcut = useRef(null);
  useEffect(() => () => cancelShortcut(shortcut), []);
  useEffect(() => { cancelShortcut(shortcut); }, [question?.id, !!feedback]);

  const source = question ? questionById(question.id, wordbooks) : null;
  const typing = question?.mode === 'typing';
  const roleTone = card ? cardRoleTone(card.type) : 'buff';
  const isWrongReveal = Boolean(feedback && !feedback.correct);

  useEffect(() => {
    if (!question || typing || feedback || busy) return;
    let selected = false;
    const onKeyDown = (event) => {
      const index = cardShortcutIndex(event);
      if (index === null || selected || document.hidden) return;
      const target = event.target;
      const root = rootRef.current;
      if (!root || !(root.contains(target) || target === root.closest('dialog') || target === document.body)) return;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
      const option = question.options[index];
      if (option === undefined) return;
      event.preventDefault();
      const button = root.querySelectorAll('.quiz-options button')[index];
      confirmShortcut(shortcut, `answer:${question.id}:${index}`, button, () => {
        selected = true;
        onAnswer(option);
      }, { mode: shortcutMode });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [question, typing, feedback, busy, onAnswer, shortcutMode]);

  useEffect(() => {
    if (!isWrongReveal || !onSkipReveal) return;
    const onKeyDown = (event) => {
      if (!['Enter', ' '].includes(event.key) || event.repeat || event.isComposing || event.defaultPrevented ||
          event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, summary, a')) return;
      event.preventDefault();
      onSkipReveal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isWrongReveal, onSkipReveal]);

  if (!question || !source) return null;

  const task = typing ? TASK_META.typing : (TASK_META[source.type] ?? {
    tone: 'meaning',
    symbol: '✦',
    title: `${QUIZ_TYPES[source.type]} 찾기`,
    prompt: '알맞은 답을 고르세요',
  });
  const promptText = typing ? source.word.meaning : source.word.term;

  return <section ref={rootRef}
    className={`battle-quiz-dock task-${task.tone}${feedback ? (feedback.correct ? ' is-reveal-correct' : ' is-reveal-wrong') : ''}`}
    aria-labelledby="quiz-type quiz-heading"
    onClick={isWrongReveal ? onSkipReveal : undefined}>
    <div className="quiz-dock-head">
      <div className="quiz-dock-top">
        {cardName ? <div className={`quiz-dock-card tone-${roleTone}`}>
          {card && <span className="quiz-dock-card-icon" aria-hidden="true"><GameIcon name={card.type} /></span>}
          <strong className="quiz-dock-card-name">{cardName}{card?.upgraded ? '+' : ''}</strong>
          {cardSummary && <small className="quiz-dock-card-effect">{cardSummary}</small>}
        </div> : <span />}

        <p className={`quiz-dock-task tone-${task.tone}`}>
          <span className="quiz-dock-task-symbol" aria-hidden="true">{task.symbol}</span>
          <strong id="quiz-type">{task.title}</strong>
          <small>{task.prompt}</small>
        </p>

        {isWrongReveal ? <span className="quiz-dock-skip-hint">클릭·Enter 넘기기</span> : <span aria-hidden="true" />}
      </div>

      <div className="quiz-dock-prompt">
        <h3 id="quiz-heading"><span lang={typing ? undefined : 'en'}>{promptText}</span></h3>
        {!typing && source.type !== 'meaning' && <span className="quiz-dock-context"><b>뜻</b> {source.word.meaning}</span>}
      </div>
    </div>

    {typing ? (
      <DockTypedAnswer key={question.id} busy={busy} feedback={feedback} source={source} showAnswerHint={showAnswerHint} onAnswer={onAnswer} onSkipReveal={onSkipReveal} />
    ) : (
      <div className="quiz-options quiz-dock-options" data-keyboard-group>
        {question.options.map((option, i) => {
          const isPicked = feedback && feedback.answer === option;
          const isAnswer = feedback && isCorrectAnswer(question, option, wordbooks);
          const isAdminHint = showAnswerHint && !feedback && isCorrectAnswer(question, option, wordbooks);
          const stateClass = !feedback
            ? (isAdminHint ? ' is-admin-answer' : '')
            : isAnswer
              ? ' is-reveal-correct'
              : isPicked
                ? ' is-reveal-wrong'
                : ' is-reveal-dim';
          return <button key={option} type="button"
            className={`quiz-dock-option${stateClass}`}
            disabled={busy || Boolean(feedback)}
            data-initial-focus={!feedback && i === 0 ? '' : undefined}
            onClick={() => { if (!busy && !feedback) onAnswer(option); }}>
            <span className="quiz-dock-option-key">{feedback ? (isAnswer ? '✓' : isPicked ? '✕' : i + 1) : i + 1}</span>
            <strong>{option}</strong>
            {isAdminHint && <em className="admin-answer-pill">정답</em>}
          </button>;
        })}
      </div>
    )}

    {isWrongReveal && revealDuration > 0 && <div className="quiz-dock-reveal-track" aria-hidden="true">
      <span key={`${question.id}-${feedback.answer}`} className="quiz-dock-reveal-bar is-wrong"
        style={{ animationDuration: `${revealDuration}ms` }} />
    </div>}
  </section>;
}
