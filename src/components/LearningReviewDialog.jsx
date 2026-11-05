import { useEffect, useMemo, useRef } from 'react';
import { ENCOUNTERS, learningSummary } from '../battle.js';

export default function LearningReviewDialog({ learning, saved, onClose, onEncounter }) {
  const dialog = useRef(null);
  const summary = useMemo(() => learningSummary(learning), [learning]);
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog className="adventure-dialog learning-review-dialog" ref={dialog} aria-labelledby="learning-review-title" onClose={onClose}>
    <header className="adventure-header"><div><p className="adventure-eyebrow">S’WORD MASTER / SPELL NOTES</p><h2 id="learning-review-title">오답 복습</h2><p>학습한 단어 {summary.learned}개 · 정답 {summary.correct} / {summary.answered}</p></div><button className="settings-close" aria-label="오답 복습 닫기" onClick={() => dialog.current.close()}>×</button></header>
    <div className="adventure-body">{summary.mistakes.length ? <><p>헷갈린 뜻과 표현을 확인하고, 해당 전투에서 다시 도전해 보세요.</p><ul className="learning-mistakes">{summary.mistakes.map((question) => <li key={`${question.word.id}-${question.type}`}><div><strong lang="en">{question.term}</strong><span>{question.type === 'meaning' ? '뜻' : question.type === 'synonyms' ? '유의어' : '반의어'}</span></div><p>{question.answer}</p><small>{question.word.meaning}</small><button className="story-text-button" onClick={() => onEncounter(question.encounterId)}>{ENCOUNTERS.find(({ id }) => id === question.encounterId).title}로 이동 →</button></li>)}</ul></>
      : <div className="learning-empty"><span aria-hidden="true">✦</span><p>{summary.answered ? '현재 남아 있는 오답이 없어요.' : '아직 풀어 본 단어 문제가 없어요.'}</p><p>브론즈 이야기의 전투에서 뜻을 해독하고 기록을 쌓아 보세요.</p></div>}</div>
    <footer className="adventure-footer"><p>{saved ? '이 브라우저에 학습 기록을 저장해요.' : '저장 공간을 사용할 수 없어 이번 접속에서만 유지해요.'}</p><button className="return-button" onClick={() => dialog.current.close()}>타이틀로</button></footer>
  </dialog>;
}
