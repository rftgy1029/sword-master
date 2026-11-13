import { useEffect, useMemo, useRef, useState } from 'react';
import { TIERS } from '../vocabulary.js';
import { learningRows, learningStats, questionType, reviewStatus, wrongRows } from '../game/learning.js';
import { normalizeText } from '../game/wordbooks.js';
import { navigateGameButtons } from './AdventureDialog.jsx';
import QuizPanel from './QuizPanel.jsx';
import { TransitionVeil, useSceneTransition } from './SceneTransition.jsx';

const STATUS_FILTERS = [
  ['all', '전체 오답'],
  ['needed', '복습 필요'],
  ['completed', '복습 완료'],
];
const percent = (part, total) => total ? `${Math.round(part / total * 100)}%` : '—';
const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];

function LearningSummary({ stats, quizWords, totalWords }) {
  return <dl className="learning-summary">
    <div><dt>학습률</dt><dd>{percent(stats.studied, quizWords)}</dd>
      <small>풀이한 단어 {stats.studied} / {quizWords}개<br />단어장 {totalWords.toLocaleString()}개 중 {quizWords}개 출제</small></div>
    <div><dt>정답률</dt><dd>{percent(stats.correct, stats.attempts)}</dd>
      <small>정답 {stats.correct} / {stats.attempts}회</small></div>
    <div><dt>오답 복습 완료율</dt><dd>{percent(stats.completed, stats.wrong)}</dd>
      <small>완료 {stats.completed} / {stats.wrong}문제<br />복습 필요 {stats.wrong - stats.completed}문제</small></div>
  </dl>;
}

export default function ReviewDialog({ progress, dispatch, error, onClose }) {
  const dialog = useRef(null);
  const body = useRef(null);
  const opener = useRef(null);
  const transition = useSceneTransition();
  const [scope, setScope] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState('');
  const [exportError, setExportError] = useState('');
  const review = progress.review;
  const wordbooks = progress.wordbooks ?? [];
  const all = useMemo(() => learningRows(progress), [progress]);
  const selected = useMemo(() => scope === 'all' ? all : learningRows(progress, scope), [all, progress, scope]);
  const stats = learningStats(selected.rows);
  const search = normalizeText(query);
  const visible = wrongRows(selected.rows).filter(({ entry, question }) =>
    (status === 'all' || entry.active === (status === 'needed')) &&
    normalizeText(`${question.word.term} ${question.word.meaning}`).includes(search));

  useEffect(() => { if (!dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => {
    const target = dialog.current.querySelector('[data-initial-focus]:not(:disabled)');
    if (!review) {
      const focus = opener.current ? [...body.current.querySelectorAll('[data-review-action]')]
        .find((button) => button.dataset.reviewAction === opener.current && !button.disabled) : null;
      (focus ?? target)?.focus();
    } else {
      body.current.scrollTop = 0;
      target?.focus();
    }
  }, [review?.question.id, !!review?.feedback]);
  const requestClose = () => transition(() => dialog.current.close());

  async function download(format) {
    setExporting(format);
    setExportError('');
    try {
      const { downloadWrongWordsPdf, downloadLearningCsv } = await import('../game/learningExport.js');
      await (format === 'pdf' ? downloadWrongWordsPdf(all.rows) : downloadLearningCsv(all.rows));
    } catch {
      setExportError('파일을 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setExporting('');
    }
  }

  return <dialog ref={dialog} className="game-dialog review-dialog" onClose={onClose}
    onCancel={(event) => { event.preventDefault(); requestClose(); }} onKeyDown={navigateGameButtons} aria-labelledby="review-title">
    <header className="game-header">
      <div><p className="game-eyebrow">단어 수련</p><h2 id="review-title">오답 복습</h2></div>
      <button className="settings-close" aria-label="오답 복습 닫기" onClick={requestClose}>×</button>
    </header>
    {error && <p className="game-save-error" role="alert">{error}</p>}
    <div ref={body} className="game-body review-body">
      {review ? <div className="review-session">
        <div className="review-controls">
          <button className="game-secondary" onClick={() => dispatch({ type: 'REVIEW_CLOSE' })}>← 오답 목록</button>
          {review.session && <p role="status">연속 복습 {review.session.index + 1} / {review.session.ids.length}</p>}
        </div>
        <QuizPanel question={review.question} feedback={review.feedback} wordbooks={wordbooks} cardName="오답 복습"
          continueLabel={review.session && review.session.index + 1 < review.session.ids.length ? '다음 문제' : '목록으로 돌아가기'}
          onAnswer={(answer) => dispatch({ type: 'REVIEW_ANSWER', id: review.question.id, answer })}
          onContinue={() => dispatch({ type: 'REVIEW_NEXT', id: review.question.id, seed: seed() })} />
      </div> : <>
        <div className="review-controls review-toolbar">
          <label className="review-field">학습 범위
            <select value={scope} onChange={(event) => setScope(event.target.value)} data-initial-focus>
              <option value="all">모든 단어장</option>
              <optgroup label="학교 단어장">
                {TIERS.map(({ id, label }) => <option key={id} value={id}>{label} 누적</option>)}
              </optgroup>
              {wordbooks.length > 0 && <optgroup label="내 단어장">
                {wordbooks.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </optgroup>}
            </select>
          </label>
          <div className="review-controls review-downloads">
            <button className="game-secondary" disabled={!!exporting || !all.rows.some(({ entry }) => entry.wrong > 0)}
              onClick={() => void download('pdf')}>{exporting === 'pdf' ? 'PDF 만드는 중…' : '전체 오답 PDF 다운로드'}</button>
            <button className="game-secondary" disabled={!!exporting || !all.rows.length}
              onClick={() => void download('csv')}>{exporting === 'csv' ? 'CSV 만드는 중…' : '학습 기록 CSV 다운로드'}</button>
          </div>
        </div>
        {exportError && <p className="game-save-error" role="alert">{exportError}</p>}
        <LearningSummary stats={stats} quizWords={selected.quizWords} totalWords={selected.totalWords} />
        <div className="review-controls review-filters">
          <div className="review-status-filters" role="group" aria-label="복습 상태" data-keyboard-group>
            {STATUS_FILTERS.map(([value, label]) => <button className="game-secondary" key={value} aria-pressed={status === value}
              onClick={() => setStatus(value)}>{label}</button>)}
          </div>
          <label className="review-field review-search"><span className="sr-only">단어·뜻 검색</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="단어·뜻 검색" />
          </label>
        </div>
        <div className="review-controls review-list-heading">
          <p role="status">{visible.length}문제 · 두 번 연속 맞히면 복습 완료</p>
          <button className="game-primary" disabled={!visible.length} data-review-action="session"
            onClick={() => {
              opener.current = 'session';
              dispatch({ type: 'REVIEW_START', ids: visible.map(({ question }) => question.id), seed: seed() });
            }}>현재 목록 연속 복습</button>
        </div>
        {visible.length ? <div className="weakness-list" data-keyboard-group>
          {visible.map(({ question, entry, source }) => <button key={question.id} className="upgrade-item review-item" data-review-action={question.id}
            onClick={() => {
              opener.current = question.id;
              dispatch({ type: 'REVIEW_START', id: question.id, seed: seed() });
            }}>
            <span className="review-word"><strong lang="en">{question.word.term}</strong>
              <small>{source} · {questionType(question)} · 오답 {entry.wrong}회 · 연속 정답 {Math.min(entry.consecutive, 2)}/2</small>
            </span>
            <span className={`review-state${entry.active ? '' : ' is-complete'}`}>{reviewStatus(entry)} <span aria-hidden="true">▸</span></span>
          </button>)}
        </div> : <div className="review-empty">
          <h3>{stats.wrong ? '조건에 맞는 오답이 없어요' : '이 범위에 기록된 오답이 없어요'}</h3>
        </div>}
      </>}
    </div>
    <footer className="game-footer"><span><kbd>방향키</kbd> 이동 <kbd>Enter</kbd> 선택 <kbd>Esc</kbd> 닫기</span>
      <span>{error ? '저장 상태를 확인하세요' : '학습 기록 자동 저장'}</span></footer>
    <TransitionVeil />
  </dialog>;
}
