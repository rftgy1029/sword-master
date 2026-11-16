const formatMb = (bytes) => (Math.max(0, bytes) / (1024 * 1024)).toFixed(1);

/**
 * First-visit asset download window shown before mounting the 3D SceneView so slow cold
 * downloads never trip SceneView's fallback timer and drop new players into 2D.
 */
export default function AssetDownloadOverlay({ progress, status, error, onRetry, onUse2d }) {
  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const totalBytes = progress?.totalBytes ?? 0;
  const loadedBytes = Math.min(totalBytes, progress?.loadedBytes ?? 0);
  const failed = status === 'error';

  return (
    <div className="asset-download-backdrop" role="region" aria-label="3D 던전 자산 다운로드">
      <section className="asset-download-card">
        <p className="asset-download-eyebrow">S’WORD MASTER</p>
        <h2>{failed ? '자산을 내려받지 못했습니다' : '던전 채비 중'}</h2>
        <p className="asset-download-status" role="status">
          {failed
            ? '네트워크 상태를 확인한 뒤 다시 받거나, 간편 화면(2D)으로 바로 시작할 수 있어요.'
            : '처음 접속할 때 3D 던전 무대와 기사 자산을 내려받고 있어요.'}
        </p>

        <div
          className="asset-download-track"
          role="progressbar"
          aria-label="3D 자산 다운로드 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className={`asset-download-fill${failed ? ' is-error' : ''}`} style={{ width: `${percent}%` }} />
        </div>

        <div className="asset-download-meta">
          <span>{failed ? '다운로드 중단됨' : (progress?.label ?? '3D 자산 확인 중…')}</span>
          <strong>
            {totalBytes > 0 ? `${formatMb(loadedBytes)} / ${formatMb(totalBytes)} MB · ` : ''}
            {percent}%
          </strong>
        </div>

        {failed && error ? <p className="asset-download-error">{error}</p> : null}

        <div className="asset-download-actions">
          {failed ? (
            <>
              <button type="button" className="game-primary" onClick={onRetry} autoFocus>
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
