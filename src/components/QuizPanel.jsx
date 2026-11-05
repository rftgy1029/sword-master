import { QUIZ_TYPES, questionById } from '../game/quiz.js';

export default function QuizPanel({ question, feedback, onAnswer, onContinue, cardName }) {
  const source = questionById(question.id);
  return <section className={`quiz-panel${feedback ? feedback.correct ? ' quiz-correct' : ' quiz-wrong' : ''}`} aria-labelledby="quiz-heading">
    <div className="quiz-heading-row">
      <p className="game-eyebrow">{feedback ? feedback.correct ? '정답 · 효과 발동' : '오답 · 효과 없음' : `${QUIZ_TYPES[source.type]} 문제`}</p>
      <span>{cardName}{!feedback && ' · 카드와 에너지 소비 완료'}</span>
    </div>
    <h3 id="quiz-heading"><span lang="en">{source.word.term}</span><small>{source.type === 'meaning' ? '이 단어의 뜻은?' : `아래 뜻에서의 ${QUIZ_TYPES[source.type]}는?`}</small></h3>
    {source.type !== 'meaning' && <p className="quiz-context">뜻: {source.word.meaning}</p>}
    {!feedback ? <div className="quiz-options" data-keyboard-group>
      {question.options.map((option, i) => <button key={option} data-initial-focus={i === 0 ? '' : undefined}
        onClick={() => onAnswer(option)}><span>{i + 1}</span>{option}</button>)}
    </div> : <div className="quiz-feedback" aria-live="polite">
      <p><strong>{feedback.correct ? '정답이에요.' : `선택한 답: ${feedback.answer}`}</strong></p>
      <p>정답: <strong>{source.answers.join(' / ')}</strong></p>
      <p>{source.word.term} — {source.word.meaning}</p>
      <p>유의어: {source.word.synonyms} · 반의어: {source.word.antonyms}</p>
      <p className="game-muted">출처: {source.word.sources.join(', ')}{!feedback.correct && ' · 약점 복습에 기록했습니다. 같은 카드 사용은 다시 시도할 수 없어요.'}</p>
      <button className="game-primary" data-initial-focus onClick={onContinue}>확인하고 계속 <span aria-hidden="true">↵</span></button>
    </div>}
  </section>;
}
