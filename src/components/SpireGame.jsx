import { useState } from 'react';
import SpireMap from './SpireMap.jsx';
import SpireBattle from './SpireBattle.jsx';
import {
  createBattle,
  createInitialRun,
  generateRewards,
  saveRun,
} from '../game/spireLogic.js';
import {
  generateQuestion,
  POTION_MAP,
  POTIONS,
  RELIC_MAP,
  RELICS,
} from '../game/spireData.js';
import { sound } from '../game/spireAudio.js';
import '../spire.css';

export default function SpireGame({ initialRun, onClose }) {
  const [run, setRun] = useState(() => initialRun || createInitialRun());
  const [rewards, setRewards] = useState(null);
  const [eventQuiz, setEventQuiz] = useState(null);
  const [eventFeedback, setEventFeedback] = useState(null);

  // 진행 상태 자동 저장
  function updateRun(nextRun) {
    setRun(nextRun);
    saveRun(nextRun);
  }

  // 노드 선택 시 진입
  function handleSelectNode(node) {
    sound.init();
    const updatedRun = { ...run, currentNode: node };

    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      const battle = createBattle(node.monsterId, updatedRun);
      updatedRun.status = 'battle';
      updatedRun.battle = battle;
      updateRun(updatedRun);
    } else if (node.type === 'rest') {
      updatedRun.status = 'rest';
      updateRun(updatedRun);
    } else if (node.type === 'shop') {
      updatedRun.status = 'shop';
      updateRun(updatedRun);
    } else if (node.type === 'event') {
      updatedRun.status = 'event';
      setEventQuiz(null);
      setEventFeedback(null);
      updateRun(updatedRun);
    }
  }

  // 층 완료 후 다음 층으로 전진
  function proceedToNextFloor(currentRun = run) {
    if (currentRun.floor >= 8) {
      // 8층 보스 클리어 -> 최종 승리!
      sound.playVictory();
      updateRun({ ...currentRun, status: 'victory' });
      return;
    }

    const nextFloor = currentRun.floor + 1;
    const cleared = currentRun.currentNode
      ? [...currentRun.clearedNodeIds, currentRun.currentNode.id]
      : currentRun.clearedNodeIds;

    const nextRun = {
      ...currentRun,
      floor: nextFloor,
      status: 'map',
      currentNode: null,
      clearedNodeIds: cleared,
      battle: null,
    };
    setRewards(null);
    updateRun(nextRun);
  }

  // 보상 화면에서 유물 선택
  function pickRelic(relicId) {
    sound.playCoin();
    const nextRun = {
      ...run,
      relics: [...run.relics, relicId],
    };
    proceedToNextFloor(nextRun);
  }

  // 상점에서 아이템 구매
  function buyShopItem(item, isPotion = false) {
    if (run.gold < item.price) return;
    sound.playCoin();

    if (isPotion) {
      if (run.potions.length >= 3) return; // 포션 최대 3개
      updateRun({
        ...run,
        gold: run.gold - item.price,
        potions: [...run.potions, item.id],
      });
    } else {
      updateRun({
        ...run,
        gold: run.gold - item.price,
        relics: [...run.relics, item.id],
      });
    }
  }

  // 휴식처 선택
  function handleRestChoice(type) {
    sound.playShield();
    let nextRun = { ...run };
    if (type === 'heal') {
      const healAmount = Math.round(run.maxHp * 0.35);
      nextRun.hp = Math.min(run.maxHp, run.hp + healAmount);
    } else if (type === 'maxHp') {
      nextRun.maxHp += 8;
      nextRun.hp += 8;
    }
    proceedToNextFloor(nextRun);
  }

  // 미지의 방 퀴즈 처리
  function handleEventQuiz(chosenIdx) {
    if (!eventQuiz || eventFeedback) return;
    const isCorrect = chosenIdx === eventQuiz.answerIndex;
    if (isCorrect) {
      sound.playCoin();
      setEventFeedback({ isCorrect: true, text: '✦ 정답! 고대의 보물 50 골드를 획득했습니다!' });
      setTimeout(() => {
        proceedToNextFloor({ ...run, gold: run.gold + 50 });
      }, 1200);
    } else {
      sound.playHurt();
      setEventFeedback({ isCorrect: false, text: `❌ 함정 발동! 10 대미지를 입었습니다. (정답: ${eventQuiz.correctAnswer})` });
      setTimeout(() => {
        const nextHp = Math.max(1, run.hp - 10);
        proceedToNextFloor({ ...run, hp: nextHp });
      }, 1400);
    }
  }

  return (
    <div className="spire-container">
      {/* 상단 통계 헤더 바 */}
      <header className="spire-header">
        <div className="spire-header-stats">
          <div className="spire-stat-pill hp">
            <span>❤️</span>
            <span>{run.hp} / {run.maxHp} HP</span>
          </div>
          <div className="spire-stat-pill gold">
            <span>💰</span>
            <span>{run.gold} G</span>
          </div>
          <div className="spire-stat-pill combo">
            <span>⚡</span>
            <span>콤보 {run.combo}</span>
          </div>
          <div className="spire-stat-pill">
            <span>🏰</span>
            <span>{run.floor}층 / 8층</span>
          </div>
        </div>

        {/* 유물 바 */}
        <div className="spire-header-relics">
          {run.relics.map((relicId) => {
            const r = RELIC_MAP.get(relicId);
            return (
              <div
                key={relicId}
                className="spire-relic-icon"
                title={`${r?.name}: ${r?.description}`}
              >
                {r?.icon}
              </div>
            );
          })}
        </div>

        {/* 포션 바 */}
        <div className="spire-header-potions">
          {run.potions.map((potionId, idx) => {
            const p = POTION_MAP.get(potionId);
            return (
              <div
                key={`${potionId}-${idx}`}
                className="spire-potion-btn"
                title={`${p?.name}: ${p?.description}`}
              >
                <span>{p?.icon}</span>
                <span>{p?.name}</span>
              </div>
            );
          })}
        </div>

        <button className="spire-leave-btn" onClick={onClose}>
          타이틀로 저장 및 나가기
        </button>
      </header>

      {/* 상태별 화면 전환 */}
      <main className="spire-main">
        {run.status === 'map' && (
          <SpireMap run={run} onSelectNode={handleSelectNode} />
        )}

        {run.status === 'battle' && run.battle && (
          <SpireBattle run={run} onUpdateRun={updateRun} />
        )}

        {/* 보상 화면 (전투 승리) */}
        {run.status === 'reward' && (
          <div className="spire-panel-center">
            <h2 style={{ color: '#d3ae63', margin: 0, fontSize: 32 }}>⚔️ 승리!</h2>
            <p style={{ color: '#a7b0a6', margin: 0 }}>
              몬스터를 처치하고 <strong>{run.lastEarnedGold} 골드</strong>를 획득했습니다!
            </p>

            <h3 style={{ margin: '14px 0 6px', color: '#f7d070' }}>🎁 전리품 유물 선택 (1개)</h3>
            <div className="spire-rewards-grid">
              {(rewards || generateRewards(run)).relicOptions.map((r) => (
                <div key={r.id} className="spire-reward-card">
                  <span style={{ fontSize: 36 }}>{r.icon}</span>
                  <strong style={{ color: '#d3ae63' }}>{r.name}</strong>
                  <span style={{ fontSize: 12, color: '#a7b0a6' }}>{r.description}</span>
                  <button
                    className="spire-btn-primary"
                    style={{ marginTop: 8 }}
                    onClick={() => pickRelic(r.id)}
                  >
                    획득하기
                  </button>
                </div>
              ))}
            </div>

            <button className="spire-leave-btn" onClick={() => proceedToNextFloor()}>
              유물 건너뛰고 다음 층으로 →
            </button>
          </div>
        )}

        {/* 모닥불 휴식처 */}
        {run.status === 'rest' && (
          <div className="spire-panel-center">
            <div style={{ fontSize: 64 }}>⛺🔥</div>
            <h2 style={{ color: '#d3ae63', margin: 0 }}>모닥불 휴식처</h2>
            <p style={{ color: '#a7b0a6' }}>
              따뜻한 모닥불 앞에서 잠시 숨을 고릅니다. 어떤 행동을 취하시겠습니까?
            </p>

            <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
              <div className="spire-reward-card" style={{ minWidth: 200 }}>
                <span style={{ fontSize: 32 }}>💖</span>
                <strong>체력 회복</strong>
                <span style={{ fontSize: 13, color: '#a7b0a6' }}>
                  체력을 {Math.round(run.maxHp * 0.35)} 회복합니다.
                </span>
                <button
                  className="spire-btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => handleRestChoice('heal')}
                >
                  휴식하기
                </button>
              </div>

              <div className="spire-reward-card" style={{ minWidth: 200 }}>
                <span style={{ fontSize: 32 }}>💪</span>
                <strong>단어 단련</strong>
                <span style={{ fontSize: 13, color: '#a7b0a6' }}>
                  최대 체력을 +8 증가시킵니다.
                </span>
                <button
                  className="spire-btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => handleRestChoice('maxHp')}
                >
                  단련하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 모험가 상점 */}
        {run.status === 'shop' && (
          <div className="spire-panel-center">
            <div style={{ fontSize: 64 }}>🧙‍♂️💰</div>
            <h2 style={{ color: '#d3ae63', margin: 0 }}>모험가의 비밀 상점</h2>
            <p style={{ color: '#a7b0a6' }}>
              "어서오게 모험가여! 골드로 좋은 물건들을 챙겨가게나." (보유: {run.gold} G)
            </p>

            <h3 style={{ margin: '12px 0 6px', color: '#f7d070' }}>판매 중인 유물</h3>
            <div className="spire-rewards-grid">
              {RELICS.filter((r) => !run.relics.includes(r.id)).slice(0, 3).map((r) => (
                <div key={r.id} className="spire-reward-card">
                  <span style={{ fontSize: 32 }}>{r.icon}</span>
                  <strong>{r.name}</strong>
                  <span style={{ fontSize: 12, color: '#a7b0a6' }}>{r.description}</span>
                  <button
                    className="spire-btn-primary"
                    disabled={run.gold < r.price}
                    onClick={() => buyShopItem(r, false)}
                  >
                    {r.price} G 구매
                  </button>
                </div>
              ))}
            </div>

            <h3 style={{ margin: '12px 0 6px', color: '#f7d070' }}>판매 중인 포션</h3>
            <div className="spire-rewards-grid">
              {POTIONS.map((p) => (
                <div key={p.id} className="spire-reward-card">
                  <span style={{ fontSize: 32 }}>{p.icon}</span>
                  <strong>{p.name}</strong>
                  <span style={{ fontSize: 12, color: '#a7b0a6' }}>{p.description}</span>
                  <button
                    className="spire-btn-primary"
                    disabled={run.gold < p.price || run.potions.length >= 3}
                    onClick={() => buyShopItem(p, true)}
                  >
                    {p.price} G 구매
                  </button>
                </div>
              ))}
            </div>

            <button
              className="spire-btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => proceedToNextFloor()}
            >
              상점 떠나기 →
            </button>
          </div>
        )}

        {/* 미지의 방 (이벤트) */}
        {run.status === 'event' && (
          <div className="spire-panel-center">
            <div style={{ fontSize: 64 }}>❓🏛️</div>
            <h2 style={{ color: '#d3ae63', margin: 0 }}>신비한 고대 사원</h2>
            <p style={{ color: '#a7b0a6' }}>
              사원 중앙의 제단에서 고대의 언어가 빛나고 있습니다.
            </p>

            {!eventQuiz ? (
              <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <div className="spire-reward-card" style={{ width: 220 }}>
                  <span style={{ fontSize: 32 }}>⛲</span>
                  <strong>치유의 분수</strong>
                  <span style={{ fontSize: 12, color: '#a7b0a6' }}>체력을 즉시 20 회복합니다.</span>
                  <button
                    className="spire-btn-primary"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      sound.playShield();
                      proceedToNextFloor({ ...run, hp: Math.min(run.maxHp, run.hp + 20) });
                    }}
                  >
                    마시기
                  </button>
                </div>

                <div className="spire-reward-card" style={{ width: 220 }}>
                  <span style={{ fontSize: 32 }}>🗝️</span>
                  <strong>황금의 수수께끼</strong>
                  <span style={{ fontSize: 12, color: '#a7b0a6' }}>단어 퀴즈에 도전해 50G를 얻습니다. (실패 시 10피해)</span>
                  <button
                    className="spire-btn-primary"
                    style={{ marginTop: 10 }}
                    onClick={() => setEventQuiz(generateQuestion())}
                  >
                    도전하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="spire-quiz-modal" style={{ width: '100%', maxWidth: 500, margin: '16px auto' }}>
                <div className="spire-quiz-term">{eventQuiz.word.term}</div>
                <div className="spire-quiz-prompt">{eventQuiz.prompt}</div>
                <div className="spire-quiz-options">
                  {eventQuiz.options.map((opt, idx) => (
                    <button
                      key={idx}
                      className="spire-quiz-opt-btn"
                      disabled={Boolean(eventFeedback)}
                      onClick={() => handleEventQuiz(idx)}
                    >
                      <span className="spire-opt-num">{idx + 1}</span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
                {eventFeedback && (
                  <div style={{ fontWeight: 'bold', color: eventFeedback.isCorrect ? '#6bf178' : '#ff6b6b' }}>
                    {eventFeedback.text}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 게임 오버 */}
        {run.status === 'gameover' && (
          <div className="spire-panel-center">
            <div style={{ fontSize: 64 }}>💀</div>
            <h2 style={{ color: '#ff6b6b', margin: 0 }}>용사가 쓰러졌습니다</h2>
            <p style={{ color: '#a7b0a6' }}>
              브론즈 첨탑 {run.floor}층에서 모험이 끝났습니다.
            </p>
            <div style={{ fontSize: 14, color: '#d3ae63', margin: '8px 0' }}>
              획득한 유물: {run.relics.length}개 · 남은 골드: {run.gold} G
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                className="spire-btn-primary"
                onClick={() => updateRun(createInitialRun())}
              >
                새로운 모험 시작
              </button>
              <button className="spire-leave-btn" onClick={onClose}>
                타이틀로 돌아가기
              </button>
            </div>
          </div>
        )}

        {/* 최종 승리 */}
        {run.status === 'victory' && (
          <div className="spire-panel-center">
            <div style={{ fontSize: 64 }}>🏆👑</div>
            <h2 style={{ color: '#ffd777', margin: 0, fontSize: 32 }}>브론즈 첨탑 정복 완료!</h2>
            <p style={{ color: '#a7b0a6', fontSize: 16 }}>
              고대 언어의 골렘을 격파하고 브론즈의 모든 단어 마법을 통달했습니다!
            </p>
            <div style={{ margin: '14px 0', padding: '16px', background: '#25302d', borderRadius: 8 }}>
              <p style={{ margin: '4px 0' }}>최종 도달 층: <strong>8층 (보스 격파)</strong></p>
              <p style={{ margin: '4px 0' }}>소지 골드: <strong>{run.gold} G</strong></p>
              <p style={{ margin: '4px 0' }}>보유 유물: <strong>{run.relics.length}개</strong></p>
            </div>
            <button
              className="spire-btn-primary"
              onClick={() => {
                updateRun(createInitialRun());
                onClose();
              }}
            >
              타이틀로 금의환향하기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
