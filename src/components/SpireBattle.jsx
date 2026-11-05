import { useEffect, useRef, useState } from 'react';
import { applyPotion, resolveTurn } from '../game/spireLogic.js';
import { sound } from '../game/spireAudio.js';
import { POTION_MAP } from '../game/spireData.js';

const SPRITES = {
  slime: '🟢',
  bat: '🦇',
  goblin: '👺',
  gargoyle: '🗿',
  skeleton: '💀',
  shade: '👤',
  golem: '🗿👑',
};

export default function SpireBattle({ run, onUpdateRun }) {
  const battle = run.battle;
  const monster = battle.monster;
  const [selectedAction, setSelectedAction] = useState(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState(0);
  const [lastFeedback, setLastFeedback] = useState(null);

  // 필요 콤보 수 (연속의 보석 유물 있으면 2, 기본 3)
  const requiredCombo = run.relics.includes('combo_gem') ? 2 : 3;
  const decodeCharged = run.combo >= requiredCombo;

  function selectAction(type) {
    if (type === 'decode' && !decodeCharged) return;
    setSelectedAction(type);
    setIsAnswering(true);
    setQuizStartTime(Date.now());
    sound.init();
  }

  function handleAnswer(index) {
    if (!isAnswering || lastFeedback) return;
    const isCorrect = index === battle.question.answerIndex;
    const timeSpent = Math.max(1, Math.round((Date.now() - quizStartTime) / 1000));

    // 사운드 재생
    if (isCorrect) {
      if (selectedAction === 'decode') sound.playCritical();
      else if (selectedAction === 'defend') sound.playShield();
      else sound.playSlash();
    } else {
      sound.playHurt();
    }

    setLastFeedback({
      isCorrect,
      chosenIndex: index,
      correctIndex: battle.question.answerIndex,
    });

    // 턴 결과 계산 (1초 후 애니메이션과 함께 적용)
    setTimeout(() => {
      const outcome = resolveTurn({
        run,
        battle,
        actionType: selectedAction,
        isCorrect,
        timeSpentSec: timeSpent,
      });

      if (outcome.isVictorious) {
        sound.playVictory();
      } else if (outcome.isDefeated) {
        sound.playGameOver();
      }

      onUpdateRun(outcome.run);
      setSelectedAction(null);
      setIsAnswering(false);
      setLastFeedback(null);
    }, 1100);
  }

  function usePotionInCombat(potionId) {
    sound.playPotion();
    const result = applyPotion(run, battle, potionId);
    if (result.success) {
      onUpdateRun({ ...result.run, battle: result.battle });
    }
  }

  // 키보드 숫자키 1~4로 퀴즈 선택 지원
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isAnswering || lastFeedback) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (!battle.hiddenIndices?.includes(idx)) {
          handleAnswer(idx);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswering, lastFeedback, battle.hiddenIndices]);

  const monsterHpPercent = Math.round((monster.hp / monster.maxHp) * 100);
  const playerHpPercent = Math.round((run.hp / run.maxHp) * 100);

  return (
    <div className="spire-battle-arena">
      {/* 전투 필드: 몬스터 vs 용사 */}
      <div className="spire-combat-field">
        {/* 플레이어 카드 */}
        <div className="spire-entity-card player-side">
          <div className="spire-entity-sprite">🗡️🧝</div>
          <div>
            <strong>모험가</strong>
            {battle.playerShield > 0 && (
              <span style={{ marginLeft: 8, color: '#68b0ff' }}>
                🛡️ +{battle.playerShield}
              </span>
            )}
          </div>
          <div className="spire-hp-bar-wrap">
            <div className="spire-hp-fill" style={{ width: `${playerHpPercent}%` }} />
            <span className="spire-hp-text">{run.hp} / {run.maxHp} HP</span>
          </div>
          <div style={{ fontSize: 13, color: '#d896ff' }}>
            연속 정답 콤보: <strong>{run.combo}</strong> / {requiredCombo}
          </div>
        </div>

        {/* 몬스터 카드 */}
        <div className="spire-entity-card monster-side">
          <div className="spire-entity-sprite">
            {SPRITES[monster.sprite] || '👾'}
          </div>
          <div>
            <strong>{monster.name}</strong>
            {monster.shield > 0 && (
              <span style={{ marginLeft: 8, color: '#68b0ff' }}>
                🛡️ +{monster.shield}
              </span>
            )}
          </div>
          <div className="spire-hp-bar-wrap">
            <div className="spire-hp-fill" style={{ width: `${monsterHpPercent}%` }} />
            <span className="spire-hp-text">{monster.hp} / {monster.maxHp} HP</span>
          </div>

          {/* 적의 다음 행동 (Intent) */}
          <div className="spire-intent-pill" title={monster.currentIntent.description}>
            {monster.currentIntent.type === 'attack' ? '⚔️ 공격' : monster.currentIntent.type === 'heavy' ? '💥 강공격' : '🛡️ 방어'} {monster.currentIntent.value}
          </div>
        </div>
      </div>

      {/* 전투 중 사용 가능한 포션 바 */}
      {run.potions.length > 0 && !isAnswering && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: '#a7b0a6' }}>소지 포션 사용:</span>
          {run.potions.map((potionId, idx) => {
            const p = POTION_MAP.get(potionId);
            return (
              <button
                key={`${potionId}-${idx}`}
                className="spire-potion-btn"
                onClick={() => usePotionInCombat(potionId)}
              >
                <span>{p?.icon}</span>
                <span>{p?.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 퀴즈 모달 (행동 선택 후 팝업) */}
      {isAnswering ? (
        <div className="spire-quiz-modal">
          <div className="spire-quiz-header">
            <div>
              <div className="spire-quiz-term">{battle.question.word.term}</div>
              <div style={{ fontSize: 12, color: '#a7b0a6' }}>
                출처: {battle.question.word.sources?.join(', ') || '교과서/모의고사'}
              </div>
            </div>
            <div className="spire-quiz-prompt">{battle.question.prompt}</div>
          </div>

          {/* 4지선다 옵션 */}
          <div className="spire-quiz-options">
            {battle.question.options.map((opt, idx) => {
              const isHidden = battle.hiddenIndices?.includes(idx);
              let statusClass = '';
              if (lastFeedback) {
                if (idx === lastFeedback.correctIndex) statusClass = ' correct-flash';
                else if (idx === lastFeedback.chosenIndex) statusClass = ' wrong-flash';
              }
              return (
                <button
                  key={idx}
                  className={`spire-quiz-opt-btn${isHidden ? ' hidden-opt' : ''}${statusClass}`}
                  disabled={Boolean(lastFeedback)}
                  onClick={() => handleAnswer(idx)}
                >
                  <span className="spire-opt-num">{idx + 1}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>

          {lastFeedback && (
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 16, color: lastFeedback.isCorrect ? '#6bf178' : '#ff6b6b' }}>
              {lastFeedback.isCorrect ? '✦ 퀴즈 정답! 단어 마법 발동!' : `❌ 오답! 정답: ${battle.question.correctAnswer}`}
            </div>
          )}
        </div>
      ) : (
        /* 행동 카드 덱 */
        <div className="spire-action-deck">
          {/* 타격 카드 */}
          <button className="spire-card-btn" onClick={() => selectAction('strike')}>
            <span className="spire-card-icon">⚔️</span>
            <span className="spire-card-name">타격 (Strike)</span>
            <span className="spire-card-desc">
              단어 퀴즈를 풀고 적에게 <strong>16 대미지</strong>를 입힙니다.
            </span>
          </button>

          {/* 수비 카드 */}
          <button className="spire-card-btn" onClick={() => selectAction('defend')}>
            <span className="spire-card-icon">🛡️</span>
            <span className="spire-card-name">수비 (Defend)</span>
            <span className="spire-card-desc">
              단어 퀴즈를 풀고 <strong>방어도 14</strong>를 충전해 피해를 막습니다.
            </span>
          </button>

          {/* 해독검 필살기 */}
          <button
            className={`spire-card-btn decode-card${decodeCharged ? ' charged' : ''}`}
            disabled={!decodeCharged}
            onClick={() => selectAction('decode')}
          >
            <span className="spire-card-icon">⚡</span>
            <span className="spire-card-name">해독검 (Decode Slash)</span>
            <span className="spire-card-desc">
              {decodeCharged ? (
                <strong style={{ color: '#ffd777' }}>발동 가능! 관통 38 대미지!</strong>
              ) : (
                `연속 정답 ${run.combo}/${requiredCombo} 필요`
              )}
            </span>
          </button>
        </div>
      )}

      {/* 전투 로그 */}
      <div className="spire-log-box">
        {battle.combatLog.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
