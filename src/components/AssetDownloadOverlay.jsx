import { useEffect, useRef } from 'react';
import { QUALITY_PRESETS } from '../game/three/quality.js';

const formatMb = (bytes) => (Math.max(0, bytes) / (1024 * 1024)).toFixed(1);

/**
 * First-visit asset download and shader warmup window shown before interacting with the 3D TitleScene
 * so cold downloads and initial shader compilation complete up front without tripping fallback timers.
 */
export default function AssetDownloadOverlay({ progress, status, error, activeQuality, onRetry, onUse2d }) {
  const cardRef = useRef(null);
  const retryRef = useRef(null);
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const totalBytes = progress?.totalBytes ?? 0;
  const loadedBytes = Math.min(totalBytes, progress?.loadedBytes ?? 0);
  const failed = status === 'error';
  const warming = !failed && (progress?.phase === 'warming' || progress?.phase === 'initializing');
  const qualityPreset = activeQuality
    ? QUALITY_PRESETS.find((preset) => preset.id === activeQuality) ?? null
    : null;

  // Keep keyboard focus inside the overlay so Enter/Space never activates menu buttons behind it,
  // while avoiding auto-focusing the 2D fallback button during normal downloading.
  useEffect(() => {
    if (failed) retryRef.current?.focus({ preventScroll: true });
    else cardRef.current?.focus({ preventScroll: true });
  }, [failed]);

  return (
    <div className="asset-download-backdrop" role="dialog" aria-modal="true" aria-labelledby="asset-download-title">
      <section ref={cardRef} className="asset-download-card" tabIndex={-1}>
        <p className="asset-download-eyebrow">S’WORD MASTER</p>
        <h2 id="asset-download-title">
          {failed ? '자산을 내려받지 못했습니다' : warming ? '그래픽 준비 중' : '던전 채비 중'}
        </h2>
        <p className="asset-download-status" role="status">
          {failed
            ? '네트워크 상태를 확인한 뒤 다시 받거나, 간편 화면(2D)으로 바로 시작할 수 있어요.'
            : warming
              ? '처음 한 번만 3D 그래픽과 전투 효과를 미리 준비하고 있어요. 준비가 끝나면 끊김 없이 바로 시작돼요.'
              : '처음 접속할 때 3D 던전 무대, 기사, 몬스터 12종과 전투 이펙트를 한 번에 내려받고 있어요.'}
        </p>

        <div
          className="asset-download-track"
          role="progressbar"
          aria-label={warming ? '3D 그래픽 준비 진행률' : '3D 자산 다운로드 진행률'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className={`asset-download-fill${failed ? ' is-error' : ''}`} style={{ width: `${percent}%` }} />
        </div>

        <div className="asset-download-meta">
          <span>{failed ? '다운로드 중단됨' : (progress?.label ?? '3D 자산 확인 중…')}</span>
          <strong>
            {!warming && totalBytes > 0 ? `${formatMb(loadedBytes)} / ${formatMb(totalBytes)} MB · ` : ''}
            {percent}%
          </strong>
        </div>

        {!failed && qualityPreset ? (
          <p className="asset-download-quality-pill">
            <strong>{qualityPreset.label}</strong>
            <span>{qualityPreset.tag}</span>
            <small>언제든 설정에서 변경 가능</small>
          </p>
        ) : null}

        {failed && error ? <p className="asset-download-error">{error}</p> : null}

        <div className="asset-download-actions">
          {failed ? (
            <>
              <button ref={retryRef} type="button" className="game-primary" onClick={onRetry}>
                다시 받기
              </button>
              <button type="button" className="game-secondary" onClick={onUse2d}>
                간편 화면(2D)으로 시작
              </button>
            </>
          ) : (
            <button type="button" className="game-secondary" onClick={onUse2d}>
              간편 화면(2D)으로 바로 시작
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
