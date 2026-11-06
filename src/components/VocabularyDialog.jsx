import { TransitionVeil, useSceneTransition } from './SceneTransition.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findVocabulary, PAGE_SIZE, TIERS } from '../vocabulary.js';

export function TierCrest({ tier, small = false }) {
  return (
    <svg className={`tier-crest tier-${tier}${small ? ' is-small' : ''}`} viewBox="0 0 24 28" aria-hidden="true">
      <path d="M3 2h18v15h-3v4h-3v3H9v-3H6v-4H3Z" />
      <path className="crest-inset" d="M6 5h12v10h-3v4H9v-4H6Z" />
      <path className="crest-star" d="M11 7h2v3h3v2h-3v3h-2v-3H8v-2h3Z" />
    </svg>
  );
}

export default function VocabularyDialog({ onClose }) {
  const dialog = useRef(null);
  const transition = useSceneTransition();
  const requestClose = () => transition(() => dialog.current.close());
  const tabButtons = useRef([]);
  const body = useRef(null);
  const results = useRef(null);
  const [tier, setTier] = useState('bronze');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 650px)').matches);
  const tierIndex = TIERS.findIndex(({ id }) => id === tier);
  const currentTier = TIERS[tierIndex];
  const newCount = currentTier.count - (TIERS[tierIndex - 1]?.count ?? 0);
  const entries = useMemo(() => findVocabulary({ tier, scope, query }), [tier, scope, query]);
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const visibleEntries = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    tabButtons.current[0]?.focus({ preventScroll: true });
    const media = window.matchMedia('(max-width: 650px)');
    const syncLayout = () => setCompact(media.matches);
    syncLayout();
    media.addEventListener('change', syncLayout);
    return () => media.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => {
    results.current?.scrollTo({ top: 0 });
  }, [tier, scope, query, page]);

  function selectTier(index) {
    setTier(TIERS[index].id);
    setPage(1);
  }

  function navigateTiers(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    const next = {
      ArrowDown: (tierIndex + 1) % TIERS.length,
      ArrowRight: (tierIndex + 1) % TIERS.length,
      ArrowUp: (tierIndex - 1 + TIERS.length) % TIERS.length,
      ArrowLeft: (tierIndex - 1 + TIERS.length) % TIERS.length,
      Home: 0, End: TIERS.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTier(next);
    tabButtons.current[next]?.focus({ preventScroll: true });
    tabButtons.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function changePage(next) {
    setPage(next);
    results.current?.focus({ preventScroll: true });
    if (compact) {
      body.current.scrollTo({
        top: results.current.getBoundingClientRect().top - body.current.getBoundingClientRect().top + body.current.scrollTop,
      });
    }
  }

  return (
    <dialog ref={dialog} className="vocabulary-dialog" aria-labelledby="vocabulary-title" onClose={onClose} onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget &&
          (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
          requestClose();
        }
      }}>
      <header className="vocabulary-header">
        <div>
          <p className="vocabulary-eyebrow"><span aria-hidden="true">✦</span> S’WORD MASTER <span>/</span> WORD ARCHIVE</p>
          <h2 id="vocabulary-title">단어장</h2>
          <p className="vocabulary-intro">모험에 필요한 단어를, 티어별로 차근차근.</p>
        </div>
        <button className="settings-close" aria-label="단어장 닫기" onClick={requestClose}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div ref={body} className="vocabulary-body">
        <aside className="vocabulary-sidebar">
          <p className="tier-list-label">학습 범위 <span>TIER</span></p>
          <div role="tablist" aria-label="단어장 티어" aria-orientation={compact ? 'horizontal' : 'vertical'} onKeyDown={navigateTiers} className="tier-tabs">
            {TIERS.map((item, index) => (
              <button key={item.id} ref={(element) => { tabButtons.current[index] = element; }}
                role="tab" type="button" id={`vocabulary-tab-${item.id}`} aria-controls="vocabulary-panel"
                aria-selected={tier === item.id} tabIndex={tier === item.id ? 0 : -1}
                className={`tier-tab${tier === item.id ? ' is-active' : ''}`} onClick={() => selectTier(index)}>
                <TierCrest tier={item.id} />
                <span className="tier-name"><span>{item.label}</span><small>{item.english}</small></span>
                <span className="tier-count">{item.count.toLocaleString('ko-KR')}<small>개</small></span>
              </button>
            ))}
          </div>
          <p className="tier-note">티어는 선생님이 정한<br />누적 학습 범위예요.<br />모든 티어를 살펴볼 수 있어요.</p>
        </aside>

        <section className="vocabulary-panel" id="vocabulary-panel" role="tabpanel" aria-labelledby={`vocabulary-tab-${tier}`}>
          <div className="vocabulary-toolbar">
            <div className="vocabulary-tier-heading">
              <div><TierCrest tier={tier} small /><h3>{currentTier.label} 단어장</h3></div>
              <span>누적 <strong>{currentTier.count.toLocaleString('ko-KR')}</strong>개</span>
            </div>
            <p className="tier-range-description">{tierIndex === 0
              ? '처음 쌓아가는 기초 학습 범위예요.'
              : `${TIERS[tierIndex - 1].label}까지의 단어와 ${currentTier.label}에서 추가된 ${newCount}개를 함께 볼 수 있어요.`}</p>
            <div className="vocabulary-filters">
              <div className="vocabulary-scope" role="group" aria-label="단어 범위">
                <button type="button" aria-pressed={scope === 'all'} onClick={() => { setScope('all'); setPage(1); }}>
                  누적 전체 <span>{currentTier.count.toLocaleString('ko-KR')}</span>
                </button>
                <button type="button" aria-pressed={scope === 'new'} onClick={() => { setScope('new'); setPage(1); }}>
                  {currentTier.label} 추가 <span>{newCount}</span>
                </button>
              </div>
              <label className="vocabulary-search">
                <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="8" r="5" /><path d="m12 12 5 5" /></svg>
                <span className="sr-only">선택한 범위에서 단어, 뜻, 유의어, 반의어, 출처 검색</span>
                <input type="search" value={query} placeholder="단어·뜻 검색" autoComplete="off" spellCheck={false}
                  onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
              </label>
            </div>
          </div>

          <div className="vocabulary-results" ref={results} tabIndex={-1}>
            <div className="vocabulary-results-heading">
              <p role="status" aria-live="polite">{query.trim() ? '검색 결과' : '단어 목록'} <strong>{entries.length.toLocaleString('ko-KR')}</strong>개</p>
              <span>단어를 누르면 유의어·반의어를 볼 수 있어요</span>
            </div>
            {entries.length > 0 ? (
              <ul className="vocabulary-list">
                {visibleEntries.map((word, index) => (
                  <li key={word.id}>
                    <details className="word-entry" key={`${word.id}-${tier}-${scope}-${page}`}>
                      <summary>
                        <span className="word-number" aria-hidden="true">{String((page - 1) * PAGE_SIZE + index + 1).padStart(2, '0')}</span>
                        <span className="word-main"><span className="word-term" lang="en">{word.term}</span><span className="word-meaning">{word.meaning}</span></span>
                        <span className={`word-tier tier-${word.tier}`}>{TIERS.find(({ id }) => id === word.tier).label}</span>
                        <span className="word-expand" aria-hidden="true">+</span>
                      </summary>
                      <dl className="word-details">
                        <div><dt>유의어</dt><dd>{word.synonyms === '—' ? '제시된 유의어 없음' : word.synonyms}</dd></div>
                        <div><dt>{word.antonyms.includes('[상대어]') ? '상대어' : '반의어'}</dt><dd>{word.antonyms === '—' ? '제시된 반의어 없음' : word.antonyms.replace('[상대어] ', '')}</dd></div>
                        <div className="word-source"><dt>출처</dt><dd>{word.sources.join(' · ')}</dd></div>
                      </dl>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="vocabulary-empty">
                <span aria-hidden="true">◇</span><h4>일치하는 단어가 없어요</h4>
                <p>다른 단어나 뜻을 입력하거나 학습 범위를 바꿔 보세요.</p>
                <button type="button" className="return-button" onClick={() => { setQuery(''); setPage(1); }}>검색 지우기</button>
              </div>
            )}
            {entries.length > PAGE_SIZE && (
              <nav className="vocabulary-pagination" aria-label="단어 목록 페이지">
                <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>← 이전</button>
                <span><strong>{page}</strong> / {pageCount}<span className="sr-only"> 페이지</span></span>
                <button type="button" disabled={page === pageCount} onClick={() => changePage(page + 1)}>다음 →</button>
              </nav>
            )}
          </div>
        </section>
      </div>

      <footer className="vocabulary-footer">
        <p><kbd>↑ ↓</kbd> 티어 이동 <span><kbd>Esc</kbd> 닫기</span></p>
        <button className="return-button" onClick={requestClose}>타이틀로 돌아가기 <span aria-hidden="true">↵</span></button>
      </footer>
    <TransitionVeil /></dialog>
  );
}
