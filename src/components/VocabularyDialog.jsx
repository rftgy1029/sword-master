import { TransitionVeil, useSceneTransition } from './SceneTransition.jsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findVocabulary, PAGE_SIZE, TIERS } from '../vocabulary.js';
import { normalizeText } from '../game/wordbooks.js';
import { buildGameHomeUrl, buildVocabularyTabUrl } from '../vocabularyUrl.js';
import WordbookImport from './WordbookImport.jsx';
import TierCrest from './ui/TierCrest.jsx';
import './vocabulary.css';

export { TierCrest };

const PAGE_SIZES = [PAGE_SIZE, 50, 100];

export default function VocabularyDialog({
  onClose,
  wordbooks = [],
  onSaveBook,
  error,
  standalone = false,
  initialState = null,
}) {
  const dialog = useRef(null);
  const transition = useSceneTransition();
  const requestClose = () => {
    if (standalone) {
      onClose();
      return;
    }
    transition(() => dialog.current?.close());
  };

  const tabButtons = useRef([]);
  const searchInput = useRef(null);
  const results = useRef(null);

  const [personal, setPersonal] = useState(() => Boolean(initialState?.personal));
  const [tier, setTier] = useState(() => initialState?.tier || 'bronze');
  const [scope, setScope] = useState(() => (initialState?.scope === 'new' ? 'new' : 'all'));
  const [query, setQuery] = useState(() => initialState?.query ?? '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [hideMode, setHideMode] = useState('none');
  const [openIds, setOpenIds] = useState(() => new Set());
  const [selectedBookId, setSelectedBookId] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [revealedPersonal, setRevealedPersonal] = useState(() => new Set());

  useEffect(() => {
    if (!initialState) return;
    setPersonal(Boolean(initialState.personal));
    setTier(initialState.tier || 'bronze');
    setScope(initialState.scope === 'new' ? 'new' : 'all');
    setQuery(initialState.query ?? '');
    setPage(1);
  }, [initialState]);

  const tierIndex = Math.max(0, TIERS.findIndex(({ id }) => id === tier));
  const currentTier = TIERS[tierIndex];
  const newCount = currentTier.count - (TIERS[tierIndex - 1]?.count ?? 0);
  const entries = useMemo(() => findVocabulary({ tier, scope, query }), [tier, scope, query]);

  const selectedBook = wordbooks.find(({ id }) => id === selectedBookId) ?? wordbooks[0] ?? null;
  const personalWords = useMemo(() => {
    if (!selectedBook) return [];
    const search = normalizeText(query);
    if (!search) return selectedBook.words;
    return selectedBook.words.filter(({ term, meaning }) => normalizeText(`${term} ${meaning}`).includes(search));
  }, [selectedBook, query]);

  const activeList = personal ? personalWords : entries;
  const pageCount = Math.max(1, Math.ceil(activeList.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleEntries = entries.slice((safePage - 1) * pageSize, safePage * pageSize);
  const visiblePersonal = personalWords.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allExpanded = visibleEntries.length > 0 && visibleEntries.every((word) => openIds.has(word.id));

  const tabUrl = useMemo(
    () => buildVocabularyTabUrl(window.location.href, { personal, tier, scope, query }),
    [personal, tier, scope, query],
  );
  const homeUrl = useMemo(
    () => buildGameHomeUrl(window.location.href),
    [],
  );

  useEffect(() => {
    if (!standalone) {
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
      tabButtons.current[tierIndex]?.focus({ preventScroll: true });
    }
  }, [standalone]);

  useEffect(() => {
    if (!standalone) return;
    const nextUrl = buildVocabularyTabUrl(window.location.href, { personal, tier, scope, query });
    if (nextUrl !== window.location.href) {
      try { window.history.replaceState(null, '', nextUrl); } catch {}
    }
  }, [standalone, personal, tier, scope, query]);

  useEffect(() => {
    results.current?.scrollTo({ top: 0 });
  }, [tier, scope, query, safePage, pageSize, personal, selectedBook?.id]);

  useEffect(() => {
    setOpenIds(new Set());
    setRevealedPersonal(new Set());
  }, [tier, scope, query, safePage, pageSize, personal, selectedBook?.id]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented) return;
      const target = event.target;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (!searchInput.current) return;
      event.preventDefault();
      searchInput.current.focus();
      searchInput.current.select();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function selectTier(index) {
    setTier(TIERS[index].id);
    setPage(1);
  }

  function switchMode(nextPersonal) {
    setPersonal(nextPersonal);
    setPage(1);
    setShowImport(false);
  }

  function toggleHideMode(mode) {
    setHideMode((prev) => (prev === mode ? 'none' : mode));
  }

  function handleWordToggle(wordId, isOpen) {
    setOpenIds((prev) => {
      if (prev.has(wordId) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(wordId);
      else next.delete(wordId);
      return next;
    });
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setOpenIds(new Set());
    } else {
      setOpenIds(new Set(visibleEntries.map((word) => word.id)));
    }
  }

  function togglePersonalReveal(rowIndex) {
    setRevealedPersonal((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function navigateTiers(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    const next = {
      ArrowDown: (tierIndex + 1) % TIERS.length,
      ArrowRight: (tierIndex + 1) % TIERS.length,
      ArrowUp: (tierIndex - 1 + TIERS.length) % TIERS.length,
      ArrowLeft: (tierIndex - 1 + TIERS.length) % TIERS.length,
      Home: 0,
      End: TIERS.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectTier(next);
    tabButtons.current[next]?.focus({ preventScroll: true });
    tabButtons.current[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function changePage(next) {
    const clamped = Math.max(1, Math.min(pageCount, next));
    setPage(clamped);
    results.current?.focus({ preventScroll: true });
  }

  const showSearch = !personal || wordbooks.length > 0;
  const hasFooterList = !personal || Boolean(selectedBook);

  const content = (
    <>
      <header className="vocabulary-header vocab-topbar">
        <div className="vocab-topbar-lead">
          <h2 id="vocabulary-title">단어장</h2>
          <div className="vocab-mode-switch" role="group" aria-label="단어장 종류">
            <button type="button" aria-pressed={!personal} onClick={() => switchMode(false)}>
              학교 단어장
            </button>
            <button type="button" aria-pressed={personal} onClick={() => switchMode(true)}>
              내 단어장
              {wordbooks.length > 0 && <span className="vocab-mode-badge">{wordbooks.length}</span>}
            </button>
          </div>
        </div>

        <div className="vocab-topbar-actions">
          {showSearch && (
            <label className="vocab-search">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8" cy="8" r="5" />
                <path d="m12 12 5 5" />
              </svg>
              <span className="sr-only">
                {personal ? '내 단어장에서 단어와 뜻 검색' : '선택한 범위에서 단어, 뜻, 유의어, 반의어, 출처 검색'}
              </span>
              <input
                ref={searchInput}
                type="search"
                value={query}
                placeholder={personal ? '내 단어장 검색 (/)' : '단어·뜻·유의어 검색 (/)'}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  type="button"
                  className="vocab-search-clear"
                  aria-label="검색 지우기"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                    searchInput.current?.focus();
                  }}
                >
                  ×
                </button>
              )}
            </label>
          )}

          {standalone ? (
            <a
              className="vocab-home-link"
              href={homeUrl}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                onClose();
              }}
            >
              ← 게임 타이틀
            </a>
          ) : (
            <>
              <a className="vocab-open-tab" href={tabUrl} target="_blank" rel="noopener noreferrer">
                새 탭으로 열기 <span aria-hidden="true">↗</span>
              </a>
              <button type="button" className="settings-close" aria-label="단어장 닫기" onClick={requestClose}>
                <span aria-hidden="true">×</span>
              </button>
            </>
          )}
        </div>
      </header>

      {(!personal || selectedBook) && (
        <div className="vocab-controls-bar">
          {!personal ? (
            <>
              <div
                role="tablist"
                aria-label="단어장 티어"
                aria-orientation="horizontal"
                onKeyDown={navigateTiers}
                className="tier-tabs"
              >
                {TIERS.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(element) => { tabButtons.current[index] = element; }}
                    role="tab"
                    type="button"
                    id={`vocabulary-tab-${item.id}`}
                    aria-controls="vocabulary-panel"
                    aria-selected={tier === item.id}
                    tabIndex={tier === item.id ? 0 : -1}
                    className={`tier-tab${tier === item.id ? ' is-active' : ''}`}
                    onClick={() => selectTier(index)}
                  >
                    <TierCrest tier={item.id} small />
                    <span className="tier-name">{item.label}</span>
                    <span className="tier-count">{item.count.toLocaleString('ko-KR')}</span>
                  </button>
                ))}
              </div>

              <div className="vocab-controls-right">
                <div className="vocab-scope" role="group" aria-label="단어 범위">
                  <button
                    type="button"
                    aria-pressed={scope === 'all'}
                    onClick={() => { setScope('all'); setPage(1); }}
                  >
                    누적 전체 <span>{currentTier.count.toLocaleString('ko-KR')}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={scope === 'new'}
                    onClick={() => { setScope('new'); setPage(1); }}
                  >
                    {currentTier.label} 추가 <span>{newCount.toLocaleString('ko-KR')}</span>
                  </button>
                </div>

                <div className="vocab-mask-group" role="group" aria-label="암기 가리기">
                  <button type="button" aria-pressed={hideMode === 'meaning'} onClick={() => toggleHideMode('meaning')}>
                    뜻 가리기
                  </button>
                  <button type="button" aria-pressed={hideMode === 'term'} onClick={() => toggleHideMode('term')}>
                    단어 가리기
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="vocab-personal-select-wrap">
                <label className="vocab-personal-select">
                  <span>단어장</span>
                  <select
                    aria-label="저장한 단어장"
                    value={selectedBook.id}
                    onChange={(event) => {
                      setSelectedBookId(event.target.value);
                      setPage(1);
                    }}
                  >
                    {wordbooks.map(({ id, name, words }) => (
                      <option key={id} value={id}>
                        {name} · {words.length.toLocaleString('ko-KR')}개
                      </option>
                    ))}
                  </select>
                </label>
                <span className="vocab-personal-count">{selectedBook.words.length.toLocaleString('ko-KR')}개</span>
              </div>

              <div className="vocab-controls-right">
                <div className="vocab-mask-group" role="group" aria-label="암기 가리기">
                  <button type="button" aria-pressed={hideMode === 'meaning'} onClick={() => toggleHideMode('meaning')}>
                    뜻 가리기
                  </button>
                  <button type="button" aria-pressed={hideMode === 'term'} onClick={() => toggleHideMode('term')}>
                    단어 가리기
                  </button>
                </div>
                <button
                  type="button"
                  className="vocab-import-toggle"
                  aria-expanded={showImport}
                  onClick={() => setShowImport((prev) => !prev)}
                >
                  {showImport ? '가져오기 닫기' : '+ 단어장 가져오기'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="vocab-workspace" ref={results} tabIndex={-1}>
        <div className="vocab-sheet">
          {!personal ? (
            <section
              className="vocabulary-panel"
              id="vocabulary-panel"
              role="tabpanel"
              aria-labelledby={`vocabulary-tab-${tier}`}
            >
              <div className="vocab-meta-bar">
                <div className="vocab-meta-info">
                  <p className="vocab-meta-status" role="status" aria-live="polite">
                    {query.trim() ? '검색 결과' : `${currentTier.label} ${scope === 'new' ? '추가 단어' : '누적 전체'}`}{' '}
                    <strong>{entries.length.toLocaleString('ko-KR')}</strong>개
                  </p>
                  <span className="vocab-meta-hint">
                    {hideMode !== 'none'
                      ? '항목을 누르면 가린 내용과 유의어·반의어를 확인할 수 있어요'
                      : '티어는 선생님이 정한 누적 학습 범위예요 · 클릭 시 유의어·반의어 펼침'}
                  </span>
                </div>

                {visibleEntries.length > 0 && (
                  <button type="button" className="vocab-expand-all" onClick={toggleExpandAll}>
                    {allExpanded ? '모두 접기' : '모두 펼치기'}
                  </button>
                )}
              </div>

              {entries.length > 0 ? (
                <div className="vocab-table-shell" data-hide-mode={hideMode}>
                  <div className="vocab-table-header" aria-hidden="true">
                    <span>#</span>
                    <span>영단어</span>
                    <span>뜻</span>
                    <span>티어</span>
                    <span />
                  </div>
                  <ul className="vocabulary-list">
                    {visibleEntries.map((word, index) => (
                      <li key={word.id}>
                        <details
                          className="word-entry"
                          open={openIds.has(word.id)}
                          onToggle={(event) => handleWordToggle(word.id, event.currentTarget.open)}
                        >
                          <summary>
                            <span className="word-number" aria-hidden="true">
                              {String((safePage - 1) * pageSize + index + 1).padStart(2, '0')}
                            </span>
                            <span className="word-term" lang="en">{word.term}</span>
                            <span className="word-meaning">{word.meaning}</span>
                            <span className={`word-tier tier-${word.tier}`}>
                              {TIERS.find(({ id }) => id === word.tier).label}
                            </span>
                            <span className="word-expand" aria-hidden="true">+</span>
                          </summary>
                          <dl className="word-details">
                            <div>
                              <dt>유의어</dt>
                              <dd>{word.synonyms === '—' ? '제시된 유의어 없음' : word.synonyms}</dd>
                            </div>
                            <div>
                              <dt>{word.antonyms.includes('[상대어]') ? '상대어' : '반의어'}</dt>
                              <dd>{word.antonyms === '—' ? '제시된 반의어 없음' : word.antonyms.replace('[상대어] ', '')}</dd>
                            </div>
                            <div className="word-source">
                              <dt>출처</dt>
                              <dd>{word.sources.join(' · ')}</dd>
                            </div>
                          </dl>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="vocabulary-empty">
                  <span aria-hidden="true">◇</span>
                  <h4>일치하는 단어가 없어요</h4>
                  <p>다른 단어나 뜻을 입력하거나 학습 범위를 바꿔 보세요.</p>
                  <button
                    type="button"
                    className="return-button"
                    onClick={() => {
                      setQuery('');
                      setPage(1);
                    }}
                  >
                    검색 지우기
                  </button>
                </div>
              )}
            </section>
          ) : (
            <section className="vocab-personal-panel" aria-label="내 단어장">
              {error && <p className="game-save-error" role="alert">{error}</p>}
              {(wordbooks.length === 0 || showImport) && (
                <div className="vocab-import-card">
                  <WordbookImport
                    wordbooks={wordbooks}
                    onSave={(newBook) => {
                      if (!onSaveBook(newBook)) return false;
                      setSelectedBookId(newBook.id);
                      setQuery('');
                      setPage(1);
                      setShowImport(false);
                      return true;
                    }}
                  />
                </div>
              )}
              {selectedBook && (
                <>
                  <div className="vocab-meta-bar">
                    <div className="vocab-meta-info">
                      <p className="vocab-meta-status" role="status" aria-live="polite">
                        {query.trim() ? '검색 결과' : selectedBook.name}{' '}
                        <strong>{personalWords.length.toLocaleString('ko-KR')}</strong>개
                      </p>
                      <span className="vocab-meta-hint">
                        {hideMode !== 'none'
                          ? '항목을 누르면 가린 내용을 확인할 수 있어요'
                          : '추가한 단어장으로 새 모험을 시작할 수 있어요'}
                      </span>
                    </div>
                  </div>

                  {personalWords.length > 0 ? (
                    <div className="vocab-table-shell" data-hide-mode={hideMode}>
                      <div className="vocab-table-header is-personal" aria-hidden="true">
                        <span>#</span>
                        <span>영단어</span>
                        <span>뜻</span>
                        <span>{hideMode !== 'none' ? '확인' : ''}</span>
                      </div>
                      <ul className="vocabulary-list is-personal">
                        {visiblePersonal.map(({ term, meaning }, index) => {
                          const rowIndex = (safePage - 1) * pageSize + index;
                          const numberLabel = String(rowIndex + 1).padStart(2, '0');
                          const isRevealed = revealedPersonal.has(rowIndex);
                          return (
                            <li key={`${selectedBook.id}-${rowIndex}`}>
                              {hideMode !== 'none' ? (
                                <button
                                  type="button"
                                  className={`personal-word-row${isRevealed ? ' is-revealed' : ''}`}
                                  aria-pressed={isRevealed}
                                  onClick={() => togglePersonalReveal(rowIndex)}
                                >
                                  <span className="word-number" aria-hidden="true">{numberLabel}</span>
                                  <span className="word-term" lang="en">{term}</span>
                                  <span className="word-meaning">{meaning}</span>
                                  <span className="personal-reveal-pill">{isRevealed ? '숨기기' : '보기'}</span>
                                </button>
                              ) : (
                                <div className="personal-word-row is-static">
                                  <span className="word-number" aria-hidden="true">{numberLabel}</span>
                                  <span className="word-term" lang="en">{term}</span>
                                  <span className="word-meaning">{meaning}</span>
                                  <span aria-hidden="true" />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div className="vocabulary-empty">
                      <span aria-hidden="true">◇</span>
                      <h4>일치하는 단어가 없어요</h4>
                      <p>다른 검색어를 입력하거나 검색을 지워 보세요.</p>
                      <button
                        type="button"
                        className="return-button"
                        onClick={() => {
                          setQuery('');
                          setPage(1);
                        }}
                      >
                        검색 지우기
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="vocabulary-footer vocab-bottombar">
        <p className="vocab-shortcuts">
          {!personal && <span><kbd>← →</kbd> 티어</span>}
          <span><kbd>/</kbd> 검색</span>
          {!standalone && <span><kbd>Esc</kbd> 닫기</span>}
        </p>

        {hasFooterList && activeList.length > 0 && (
          <nav className="vocabulary-pagination" aria-label="단어 목록 페이지">
            <button type="button" disabled={safePage <= 1} onClick={() => changePage(safePage - 1)}>
              ← 이전
            </button>
            <span>
              <strong>{safePage}</strong> / {pageCount}
              <span className="sr-only"> 페이지</span>
            </span>
            <button type="button" disabled={safePage >= pageCount} onClick={() => changePage(safePage + 1)}>
              다음 →
            </button>
          </nav>
        )}

        {hasFooterList && (
          <label className="vocab-page-size">
            <span className="sr-only">페이지당 단어 수</span>
            <select
              aria-label="페이지당 단어 수"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}개씩</option>
              ))}
            </select>
          </label>
        )}
      </footer>
    </>
  );

  if (standalone) {
    return (
      <main className="vocabulary-dialog is-fullscreen is-standalone" aria-labelledby="vocabulary-title">
        {content}
      </main>
    );
  }

  return (
    <dialog
      ref={dialog}
      className="vocabulary-dialog is-fullscreen"
      aria-labelledby="vocabulary-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
        ) {
          requestClose();
        }
      }}
    >
      {content}
      <TransitionVeil />
    </dialog>
  );
}
