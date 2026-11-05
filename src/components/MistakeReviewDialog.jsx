import { useState } from 'react';
import { loadMistakes, saveMistakes } from '../game/spireLogic.js';

export default function MistakeReviewDialog({ onClose }) {
  const [mistakes, setMistakes] = useState(loadMistakes);

  function clearAll() {
    saveMistakes([]);
    setMistakes([]);
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog-card review-dialog"
        style={{
          maxWidth: 620,
          background: '#1a2220',
          border: '2px solid #82744f',
          padding: 24,
          borderRadius: 8,
          color: '#eeebdd',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: 'Cormorant, serif', fontSize: 28, color: '#d3ae63' }}>
            📖 오답 복습 노트
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a7b0a6',
              fontSize: 24,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#a7b0a6' }}>
          브론즈 첨탑을 오르며 틀렸던 단어들입니다. 취약한 단어를 확인하고 다음 런을 준비하세요.
        </p>

        {mistakes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#889894' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✨</div>
            <p>아직 틀린 단어가 없습니다! 멋진 실력입니다.</p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6 }}>
            {mistakes.map((word) => (
              <div
                key={word.id}
                style={{
                  background: '#232c2a',
                  border: '1px solid #384642',
                  borderRadius: 6,
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ffd777' }}>
                    {word.term}
                  </div>
                  <div style={{ fontSize: 14, color: '#eeebdd', marginTop: 2 }}>
                    뜻: {word.meaning}
                  </div>
                  {word.synonyms && word.synonyms !== '—' && (
                    <div style={{ fontSize: 12, color: '#88a39b' }}>
                      유의어: {word.synonyms}
                    </div>
                  )}
                  {word.antonyms && word.antonyms !== '—' && (
                    <div style={{ fontSize: 12, color: '#a38888' }}>
                      반의어: {word.antonyms}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#6d7c77', textAlign: 'right' }}>
                  출처: {word.sources?.join(', ') || '교과서/모의고사'}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {mistakes.length > 0 && (
            <button
              onClick={clearAll}
              style={{
                background: 'transparent',
                border: '1px solid #6b4444',
                color: '#e77c7c',
                padding: '6px 14px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              오답 노트 비우기
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: '#34433f',
              border: '1px solid #d3ae63',
              color: '#eeebdd',
              padding: '6px 18px',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
