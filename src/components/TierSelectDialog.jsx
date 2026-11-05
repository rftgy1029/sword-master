import { useEffect, useRef } from 'react';
import { TIERS } from '../vocabulary.js';
import { STORIES } from '../story.js';
import TierCrest from './TierCrest.jsx';

export default function TierSelectDialog({ onClose, onStart }) {
  const dialog = useRef(null);
  const choices = useRef([]);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    choices.current[0]?.focus({ preventScroll: true });
  }, []);

  function navigate(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    const available = choices.current.filter((button) => button && !button.disabled);
    const index = available.indexOf(event.target);
    if (index < 0) return;
    const next = { ArrowDown: (index + 1) % available.length, ArrowRight: (index + 1) % available.length,
      ArrowUp: (index - 1 + available.length) % available.length, ArrowLeft: (index - 1 + available.length) % available.length,
      Home: 0, End: available.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    available[next]?.focus();
  }

  return (
    <dialog ref={dialog} className="adventure-dialog" aria-labelledby="adventure-title" aria-describedby="adventure-description" onClose={onClose}>
      <header className="adventure-header">
        <div><p className="adventure-eyebrow">S’WORD MASTER <span>/</span> A NEW ADVENTURE</p>
          <h2 id="adventure-title">어떤 이야기를 펼칠까요?</h2>
          <p id="adventure-description">티어를 선택하면 그 티어의 이야기가 시작돼요.</p></div>
        <button className="settings-close" aria-label="티어 선택 닫기" onClick={() => dialog.current.close()}>×</button>
      </header>
      <div className="adventure-body">
        <p className="adventure-section-label">모험의 이야기 <span>SELECT YOUR TIER</span></p>
        <div className="adventure-tiers" onKeyDown={navigate}>
          {TIERS.map((tier, index) => {
            const story = STORIES[tier.id];
            return (
              <button type="button" key={tier.id} ref={(element) => { choices.current[index] = element; }}
                className={`adventure-tier tier-${tier.id}${story ? ' is-ready' : ''}`} disabled={!story}
                onClick={() => onStart(tier.id)}>
                <TierCrest tier={tier.id} />
                <span className="adventure-tier-copy"><span className="adventure-tier-name">{tier.label}<small>{tier.english}</small></span>
                  <span className="adventure-tier-story">{story ? `제${story.chapter}장 · ${story.title}` : '새로운 이야기를 준비하고 있어요'}</span>
                  {story && <span className="adventure-tier-detail">어두운 문 너머, 뜻밖의 축제가 당신을 기다립니다.</span>}</span>
                <span className="adventure-tier-status">{story ? <>스토리 보기 <span aria-hidden="true">→</span></> : '준비 중'}</span>
              </button>
            );
          })}
        </div>
      </div>
      <footer className="adventure-footer"><p>티어는 학습 범위예요. 이야기의 승급 조건은 없어요.</p>
        <button className="story-text-button" onClick={() => dialog.current.close()}><kbd>Esc</kbd> 타이틀로</button></footer>
    </dialog>
  );
}
