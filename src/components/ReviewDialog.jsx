import { useEffect, useRef } from 'react';
import { questionById, QUIZ_TYPES } from '../game/quiz.js';
import { navigateGameButtons } from './AdventureDialog.jsx';
import QuizPanel from './QuizPanel.jsx';

export default function ReviewDialog({ progress, dispatch, error, onClose }) {
  const dialog = useRef(null);
  const review = progress.review;
  const learning = progress.learning;
  const weaknesses = Object.entries(learning.entries).filter(([, e]) => e.active).sort((a, b) => b[1].wrong - a[1].wrong);
  const completed = Object.values(learning.entries).filter((e) => e.wrong > 0 && !e.active).length;
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => { dialog.current.querySelector('[data-initial-focus]:not(:disabled)')?.focus(); }, [review?.question.id, !!review?.feedback]);
  return <dialog ref={dialog} className="game-dialog review-dialog" onClose={onClose} onKeyDown={navigateGameButtons} aria-labelledby="review-title">
    <header className="game-header"><div><p className="game-eyebrow">✦ S’WORD MASTER / WORD PRACTICE</p><h2 id="review-title">오답 복습</h2></div>
      <button className="settings-close" aria-label="오답 복습 닫기" onClick={() => dialog.current.close()}>×</button></header>
    {error && <p className="game-save-error" role="alert">{error}</p>}
    <div className="game-body">
      <div className="learning-summary"><span>총 풀이 <strong>{learning.attempts}</strong></span><span>정답률 <strong>{learning.attempts ? Math.round(learning.correct / learning.attempts * 100) : 0}%</strong></span><span>남은 약점 <strong>{weaknesses.length}</strong></span><span>복습 완료 <strong>{completed}</strong></span></div>
      {review ? <><button className="game-secondary" onClick={() => dispatch({ type: 'REVIEW_CLOSE' })}>← 약점 목록으로</button>
        <QuizPanel question={review.question} feedback={review.feedback} cardName="약점 복습 · 전투에 영향 없음"
          onAnswer={(answer) => dispatch({ type: 'REVIEW_ANSWER', id: review.question.id, answer })}
          onContinue={() => dispatch({ type: 'REVIEW_CLOSE' })} />
      </> : <><p className="game-help">틀린 문제를 두 번 연속 맞히면 복습 완료로 표시합니다. 학습 기록은 계속 보관됩니다.</p>
        {weaknesses.length ? <div className="weakness-list" data-keyboard-group>{weaknesses.map(([id, entry], i) => {
          const q = questionById(id);
          return <button key={id} className="upgrade-item" data-initial-focus={i === 0 ? '' : undefined}
            onClick={() => dispatch({ type: 'REVIEW_START', id, seed: crypto.getRandomValues(new Uint32Array(1))[0] })}>
            <span><strong lang="en">{q.word.term}</strong><small>{QUIZ_TYPES[q.type]} · 오답 {entry.wrong}회 · 연속 정답 {entry.consecutive}/2</small></span><span>복습 ▸</span>
          </button>;
        })}</div> : <div className="review-empty"><span aria-hidden="true">✦</span><h3>{completed ? '약점 복습을 마쳤습니다' : '아직 기록된 오답이 없어요'}</h3><p>모험에서 틀린 문제는 여기에 모입니다.</p><button className="game-primary" data-initial-focus onClick={() => dialog.current.close()}>타이틀로 돌아가기</button></div>}
      </>}
      <p className="game-help">던전 클리어 {Object.values(learning.clears).reduce((a, b) => a + b, 0)}회 · 모험 시작 {learning.runs}회</p>
    </div><footer className="game-footer"><span><kbd>방향키</kbd> 이동 <kbd>Enter</kbd> 선택 <kbd>Esc</kbd> 닫기</span><span>{error ? '저장 상태를 확인하세요' : '학습 기록 자동 저장'}</span></footer>
  </dialog>;
}
