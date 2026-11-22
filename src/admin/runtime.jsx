import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MONSTERS } from '../game/catalog.js';
import { questionById } from '../game/quiz.js';
import { TIERS } from '../vocabulary.js';
import { createAdminReducer, pickQuizAnswer } from './adminEngine.js';
import {
  ADMIN_PROGRESS_KEY,
  DEFAULT_ADMIN_CHEATS,
  countActiveCheats,
  readAdminCheats,
  saveAdminCheats,
} from './adminState.js';
import './admin.css';

export const ADMIN_MODE = true;
export const ACTIVE_PROGRESS_KEY = ADMIN_PROGRESS_KEY;

const AdminContext = createContext(null);

function ToggleRow({ label, description, checked, onToggle }) {
  return (
    <button
      type="button"
      className={`admin-toggle${checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
    >
      <span className="admin-toggle-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="admin-switch" aria-hidden="true">{checked ? 'ON' : 'OFF'}</span>
    </button>
  );
}

function StatRow({ label, value, steps, disabled = false }) {
  return (
    <div className="admin-stat-row">
      <div className="admin-stat-meta">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="admin-stat-steps">
        {steps.map(({ text, onClick, disabled: stepDisabled }) => (
          <button
            key={text}
            type="button"
            className="admin-step-btn"
            disabled={disabled || stepDisabled}
            onClick={onClick}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminProvider({ children }) {
  const [cheats, setCheats] = useState(readAdminCheats);
  const [open, setOpen] = useState(false);
  const cheatsRef = useRef(cheats);
  cheatsRef.current = cheats;
  const battleActionsRef = useRef(null);

  useEffect(() => {
    saveAdminCheats(cheats);
  }, [cheats]);

  const setCheat = useCallback((key, value) => {
    setCheats((current) => {
      if (!(key in DEFAULT_ADMIN_CHEATS)) return current;
      const nextValue = typeof value === 'function' ? Boolean(value(current[key])) : Boolean(value);
      if (current[key] === nextValue) return current;
      const next = { ...current, [key]: nextValue };
      cheatsRef.current = next;
      return next;
    });
  }, []);

  const resetCheats = useCallback(() => {
    const next = { ...DEFAULT_ADMIN_CHEATS };
    cheatsRef.current = next;
    setCheats(next);
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((was) => !was);
  }, []);

  const registerBattleActions = useCallback((actions) => {
    battleActionsRef.current = actions;
    return () => {
      if (battleActionsRef.current === actions) battleActionsRef.current = null;
    };
  }, []);

  const reducer = useMemo(() => createAdminReducer(() => cheatsRef.current), []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.isComposing) return;
      if ((event.ctrlKey || event.altKey) && event.shiftKey && !event.metaKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        event.stopPropagation();
        setOpen((was) => !was);
        return;
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        event.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const activeCheatCount = useMemo(() => countActiveCheats(cheats), [cheats]);

  const value = useMemo(() => ({
    enabled: true,
    open,
    setOpen,
    toggleOpen,
    cheats,
    activeCheatCount,
    setCheat,
    resetCheats,
    registerBattleActions,
    battleActionsRef,
    createReducer: () => reducer,
  }), [open, toggleOpen, cheats, activeCheatCount, setCheat, resetCheats, registerBattleActions, reducer]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin은 AdminProvider 안에서 사용해야 합니다.');
  return ctx;
}

function describeContext(progress, openedMenu) {
  const run = progress?.run;
  const review = progress?.review;
  if (openedMenu === '오답 복습') {
    return review ? '오답 복습 · 퀴즈 진행 중' : '오답 복습 화면';
  }
  if (run && run.phase !== 'result' && ['새 모험', '이어하기'].includes(openedMenu)) {
    const tierName = TIERS.find((t) => t.id === run.tier)?.label
      ?? progress.wordbooks?.find((b) => b.id === run.tier)?.name
      ?? run.tier;
    if (run.phase === 'battle' && run.battle) {
      const monster = MONSTERS[run.battle.enemy.type]?.name ?? run.battle.enemy.type;
      return `${tierName} · ${run.floor + 1}층 전투 · ${monster} (${run.battle.enemy.hp}/${run.battle.enemy.maxHp})`;
    }
    const phaseNames = { map: '던전 경로', reward: '보상 선택', rest: '돌불 쉼터', forge: '불씨 대장간' };
    return `${tierName} · ${Math.max(1, run.floor + 1)}층 · ${phaseNames[run.phase] ?? run.phase}`;
  }
  if (openedMenu) return `${openedMenu} 화면`;
  return '타이틀 화면';
}

export function AdminOverlay({ progress, dispatch, resetProgress, openedMenu }) {
  const admin = useAdmin();
  const [portalTarget, setPortalTarget] = useState(() => document.body);
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const noticeTimer = useRef(null);
  const confirmTimer = useRef(null);

  useEffect(() => () => {
    clearTimeout(noticeTimer.current);
    clearTimeout(confirmTimer.current);
  }, []);

  const flash = useCallback((text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2200);
  }, []);

  useLayoutEffect(() => {
    const syncTarget = () => {
      const dialogs = [...document.querySelectorAll('dialog[open]')];
      const next = dialogs.at(-1) ?? document.body;
      setPortalTarget((prev) => (prev === next ? prev : next));
    };
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    return () => observer.disconnect();
  }, [openedMenu]);

  const run = progress?.run;
  const wordbooks = progress?.wordbooks ?? [];
  const inRun = Boolean(run && run.phase !== 'result');
  const inBattle = Boolean(inRun && run.phase === 'battle' && run.battle);
  const battle = inBattle ? run.battle : null;
  const combatPending = inBattle && battle.pending && !battle.feedback ? battle.pending : null;
  const reviewPending = openedMenu === '오답 복습' && progress?.review && !progress.review.feedback
    ? progress.review
    : null;
  const activeQuestion = combatPending?.question ?? reviewPending?.question ?? null;
  const activeSource = activeQuestion ? questionById(activeQuestion.id, wordbooks) : null;
  const activeAnswer = activeQuestion ? pickQuizAnswer(activeQuestion, wordbooks, true) : null;

  const submitQuickAnswer = (correct) => {
    if (!activeQuestion) return;
    const choice = pickQuizAnswer(activeQuestion, wordbooks, correct);
    if (choice === null) return;
    if (combatPending) {
      const handler = admin.battleActionsRef?.current?.answer;
      if (handler) handler(choice);
      else dispatch({ type: 'ANSWER', id: activeQuestion.id, answer: choice });
      flash(correct ? '전투 퀴즈 즉시 정답 처리' : '전투 퀴즈 즉시 오답 처리');
    } else if (reviewPending) {
      dispatch({ type: 'REVIEW_ANSWER', id: activeQuestion.id, answer: choice });
      flash(correct ? '복습 퀴즈 즉시 정답 처리' : '복습 퀴즈 즉시 오답 처리');
    }
  };

  const modifyStats = (patch, message) => {
    if (dispatch({ type: 'ADMIN_MODIFY_STATS', patch }) && message) {
      flash(message);
    }
  };

  const toggleInfiniteEnergy = () => {
    const nextOn = !admin.cheats.infiniteEnergy;
    admin.setCheat('infiniteEnergy', nextOn);
    if (nextOn && battle && battle.energy < 3) {
      dispatch({ type: 'ADMIN_MODIFY_STATS', patch: { energy: 3 } });
    }
    flash(nextOn ? '무한 에너지 활성화' : '무한 에너지 해제');
  };

  const handleResetProgress = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmReset(false), 4000);
      return;
    }
    clearTimeout(confirmTimer.current);
    setConfirmReset(false);
    resetProgress?.();
    flash('관리자 저장 기록을 초기화했습니다.');
  };

  const canModifyBattleAction = inBattle && !battle.pending && !battle.feedback;

  return createPortal(
    <div
      className="admin-portal-root"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') event.stopPropagation();
      }}
    >
      <button
        type="button"
        className={`admin-fab${admin.activeCheatCount > 0 ? ' has-active' : ''}${admin.open ? ' is-open' : ''}`}
        aria-expanded={admin.open}
        aria-controls="admin-drawer"
        title="관리자 패널 열기 (Ctrl+Shift+A)"
        onClick={admin.toggleOpen}
      >
        <span className="admin-fab-dot" aria-hidden="true" />
        <span>ADMIN</span>
        {admin.activeCheatCount > 0 && (
          <span className="admin-fab-count" aria-label={`활성 치트 ${admin.activeCheatCount}개`}>
            {admin.activeCheatCount}
          </span>
        )}
      </button>

      {admin.open && (
        <aside id="admin-drawer" className="admin-drawer" aria-label="관리자 도구">
          <header className="admin-drawer-head">
            <div>
              <p className="admin-drawer-eyebrow">S’WORD MASTER · ADMIN</p>
              <h2 className="admin-drawer-title">
                관리자 도구
                {admin.activeCheatCount > 0 && <span className="admin-pill">활성 {admin.activeCheatCount}</span>}
              </h2>
            </div>
            <button
              type="button"
              className="admin-close-btn"
              aria-label="관리자 도구 닫기"
              onClick={() => admin.setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="admin-context-bar">
            <span>현재 상태 · <strong>{describeContext(progress, openedMenu)}</strong></span>
            {notice && <p className="admin-feedback" role="status">{notice}</p>}
          </div>

          <div className="admin-drawer-body">
            <section className="admin-section" aria-label="퀴즈 보조">
              <h3 className="admin-section-title">퀴즈 보조</h3>
              <div className="admin-toggle-list">
                <ToggleRow
                  label="정답 하이라이트"
                  description="전투·오답 복습 퀴즈에서 정답 보기 표시"
                  checked={admin.cheats.showAnswer}
                  onToggle={() => admin.setCheat('showAnswer', (v) => !v)}
                />
                <ToggleRow
                  label="퀴즈 스킵 (카드 즉시 발동)"
                  description="퀴즈 없이 바로 발동 · 학습 통계 미기록"
                  checked={admin.cheats.skipQuiz}
                  onToggle={() => admin.setCheat('skipQuiz', (v) => !v)}
                />
              </div>

              {activeQuestion && activeSource ? (
                <div className="admin-quiz-preview">
                  현재 문제 <strong lang="en">{activeSource.word.term}</strong>
                  {' → '}
                  <strong>{activeAnswer ?? activeSource.answers.join(' / ')}</strong>
                </div>
              ) : (
                <p className="admin-muted-note">퀴즈가 열리면 즉시 정답·오답 버튼이 활성화됩니다.</p>
              )}

              <div className="admin-btn-grid">
                <button
                  type="button"
                  className="admin-btn is-primary"
                  disabled={!activeQuestion}
                  onClick={() => submitQuickAnswer(true)}
                >
                  ✓ 즉시 정답
                </button>
                <button
                  type="button"
                  className="admin-btn is-danger"
                  disabled={!activeQuestion}
                  onClick={() => submitQuickAnswer(false)}
                >
                  ✕ 즉시 오답
                </button>
              </div>
            </section>

            <section className="admin-section" aria-label="전투 치트">
              <h3 className="admin-section-title">전투 치트</h3>
              <div className="admin-toggle-list">
                <ToggleRow
                  label="무적 (피해 0)"
                  description="적의 모든 공격 피해를 0으로 무효화"
                  checked={admin.cheats.invincible}
                  onToggle={() => admin.setCheat('invincible', (v) => !v)}
                />
                <ToggleRow
                  label="무한 에너지"
                  description="카드 사용 시 에너지를 소모하지 않음"
                  checked={admin.cheats.infiniteEnergy}
                  onToggle={toggleInfiniteEnergy}
                />
                <ToggleRow
                  label="원킬 모드"
                  description="공격 카드 적중 시 적을 즉시 처치"
                  checked={admin.cheats.oneHitKill}
                  onToggle={() => admin.setCheat('oneHitKill', (v) => !v)}
                />
              </div>

              <div className="admin-btn-grid">
                <button
                  type="button"
                  className="admin-btn is-danger is-full"
                  disabled={!inBattle}
                  onClick={() => {
                    if (dispatch({ type: 'ADMIN_KILL_ENEMY' })) flash('적을 즉시 처치했습니다.');
                  }}
                >
                  ⚡ 적 즉사 (즉시 승리)
                </button>
                <button
                  type="button"
                  className="admin-btn is-primary"
                  disabled={!inRun || run.hp >= run.maxHp}
                  onClick={() => modifyStats({ hp: run.maxHp }, 'HP를 최대로 회복했습니다.')}
                >
                  ✚ HP 최대 회복
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={!canModifyBattleAction || battle.hand.length >= 10}
                  onClick={() => {
                    if (dispatch({ type: 'ADMIN_DRAW_CARDS', count: 1 })) flash('카드 1장을 뽑았습니다.');
                  }}
                >
                  +1 카드 뽑기
                </button>
              </div>
            </section>

            <section className="admin-section" aria-label="수치 조절">
              <h3 className="admin-section-title">수치 직접 조절</h3>
              {inRun ? (
                <div className="admin-stat-list">
                  <StatRow
                    label="HP"
                    value={`${run.hp} / ${run.maxHp}`}
                    steps={[
                      { text: '-10', onClick: () => modifyStats({ hp: run.hp - 10 }) },
                      { text: '-1', onClick: () => modifyStats({ hp: run.hp - 1 }) },
                      { text: '+10', onClick: () => modifyStats({ hp: run.hp + 10 }) },
                      { text: '최대', onClick: () => modifyStats({ hp: run.maxHp }) },
                    ]}
                  />
                  <StatRow
                    label="최대 HP"
                    value={run.maxHp}
                    steps={[
                      { text: '-10', onClick: () => modifyStats({ maxHp: run.maxHp - 10 }) },
                      { text: '+10', onClick: () => modifyStats({ maxHp: run.maxHp + 10 }) },
                      { text: '+50', onClick: () => modifyStats({ maxHp: run.maxHp + 50 }) },
                    ]}
                  />
                  <StatRow
                    label="금화"
                    value={run.gold}
                    steps={[
                      { text: '-50', onClick: () => modifyStats({ gold: run.gold - 50 }) },
                      { text: '+50', onClick: () => modifyStats({ gold: run.gold + 50 }) },
                      { text: '+500', onClick: () => modifyStats({ gold: run.gold + 500 }) },
                    ]}
                  />
                  {inBattle && (
                    <>
                      <StatRow
                        label="에너지"
                        value={battle.energy}
                        steps={[
                          { text: '-1', onClick: () => modifyStats({ energy: battle.energy - 1 }) },
                          { text: '+1', onClick: () => modifyStats({ energy: battle.energy + 1 }) },
                          { text: '+3', onClick: () => modifyStats({ energy: battle.energy + 3 }) },
                        ]}
                      />
                      <StatRow
                        label="방어"
                        value={battle.block}
                        steps={[
                          { text: '0', onClick: () => modifyStats({ block: 0 }) },
                          { text: '+5', onClick: () => modifyStats({ block: battle.block + 5 }) },
                          { text: '+20', onClick: () => modifyStats({ block: battle.block + 20 }) },
                        ]}
                      />
                      <StatRow
                        label="힘"
                        value={battle.strength}
                        steps={[
                          { text: '-1', onClick: () => modifyStats({ strength: battle.strength - 1 }) },
                          { text: '+1', onClick: () => modifyStats({ strength: battle.strength + 1 }) },
                          { text: '+5', onClick: () => modifyStats({ strength: battle.strength + 5 }) },
                        ]}
                      />
                      <StatRow
                        label="집중"
                        value={battle.focus}
                        steps={[
                          { text: '0', onClick: () => modifyStats({ focus: 0 }) },
                          { text: '+5', onClick: () => modifyStats({ focus: battle.focus + 5 }) },
                          { text: '+15', onClick: () => modifyStats({ focus: battle.focus + 15 }) },
                        ]}
                      />
                      <StatRow
                        label="적 HP"
                        value={`${battle.enemy.hp} / ${battle.enemy.maxHp}`}
                        steps={[
                          { text: 'HP 1', onClick: () => modifyStats({ enemyHp: 1 }) },
                          { text: '-10', onClick: () => modifyStats({ enemyHp: battle.enemy.hp - 10 }) },
                          { text: '+10', onClick: () => modifyStats({ enemyHp: battle.enemy.hp + 10 }) },
                        ]}
                      />
                      <StatRow
                        label="적 방어"
                        value={battle.enemy.block}
                        steps={[
                          { text: '0', onClick: () => modifyStats({ enemyBlock: 0 }) },
                          { text: '+10', onClick: () => modifyStats({ enemyBlock: battle.enemy.block + 10 }) },
                        ]}
                      />
                      <StatRow
                        label="적 힘"
                        value={battle.enemy.strength}
                        steps={[
                          { text: '-1', onClick: () => modifyStats({ enemyStrength: battle.enemy.strength - 1 }) },
                          { text: '+1', onClick: () => modifyStats({ enemyStrength: battle.enemy.strength + 1 }) },
                        ]}
                      />
                      <StatRow
                        label="적 약화"
                        value={battle.enemy.weak}
                        steps={[
                          { text: '0', onClick: () => modifyStats({ enemyWeak: 0 }) },
                          { text: '+1', onClick: () => modifyStats({ enemyWeak: battle.enemy.weak + 1 }) },
                          { text: '+3', onClick: () => modifyStats({ enemyWeak: battle.enemy.weak + 3 }) },
                        ]}
                      />
                    </>
                  )}
                </div>
              ) : (
                <p className="admin-muted-note">모험을 시작하면 HP·금화·전투 수치를 직접 조절할 수 있습니다.</p>
              )}
            </section>

            <section className="admin-section" aria-label="편의 및 저장 관리">
              <h3 className="admin-section-title">편의 · 저장 관리</h3>
              <div className="admin-toggle-list">
                <ToggleRow
                  label="전체 티어 해금"
                  description="브론즈~마스터 즉시 선택 가능 (클리어 기록 미변조)"
                  checked={admin.cheats.unlockAllTiers}
                  onToggle={() => admin.setCheat('unlockAllTiers', (v) => !v)}
                />
              </div>
              <div className="admin-btn-grid">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={admin.activeCheatCount === 0}
                  onClick={() => {
                    admin.resetCheats();
                    flash('모든 치트를 껐습니다.');
                  }}
                >
                  모든 치트 끄기
                </button>
                <button
                  type="button"
                  className="admin-btn is-danger"
                  onClick={handleResetProgress}
                >
                  {confirmReset ? '다시 눌러 초기화 확정' : '관리자 저장 초기화'}
                </button>
              </div>
            </section>
          </div>

          <footer className="admin-drawer-foot">
            별도 저장소({ADMIN_PROGRESS_KEY}) 사용 · 단축키 Ctrl+Shift+A
          </footer>
        </aside>
      )}
    </div>,
    portalTarget,
  );
}
