import { useCallback, useEffect, useRef, useState } from 'react';
import { TierCrest } from './VocabularyDialog.jsx';

export default function DungeonEntrance({ tier, motionPreference, onComplete }) {
  const host = useRef(null);
  const completed = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [failed, setFailed] = useState(false);
  onCompleteRef.current = onComplete;
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let controller;
    import('../game/entranceScene.js').then(({ startEntranceScene }) => {
      if (cancelled) return;
      controller = startEntranceScene(host.current, { motionPreference, onComplete: finish });
    }).catch(() => {
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      controller?.destroy();
    };
  }, [motionPreference, finish]);

  return <section className="dungeon-entrance" aria-label="용사의 던전 입장">
    <div className="entrance-heading"><TierCrest tier={tier.id} />
      <div><p className="game-eyebrow">{tier.label} · 누적 {tier.count.toLocaleString()}개</p><h3>황혼의 석문</h3></div>
    </div>
    <div className="entrance-viewport"><div ref={host} className="entrance-canvas" aria-hidden="true" /></div>
    <div className="entrance-actions"><p role="status">{failed ? '입장 장면을 불러오지 못했습니다. 경로 선택으로 계속할 수 있어요.' : '용사가 던전에 입장하고 있습니다.'}</p>
      <button className="game-secondary" data-initial-focus onClick={finish}>{failed ? '경로 선택으로' : '입장 건너뛰기'} <span aria-hidden="true">▸</span></button>
    </div>
  </section>;
}
