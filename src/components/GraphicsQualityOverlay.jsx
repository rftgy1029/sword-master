import { useEffect, useRef, useState } from 'react';
import { QUALITY_PRESETS } from '../game/three/quality.js';

/**
 * First-launch 3D graphics quality picker shown before the first TitleScene Canvas mounts.
 * Assets continue preloading silently in the background while the player selects their tier.
 */
export default function GraphicsQualityOverlay({
  recommended = 'balanced',
  preloadReady = false,
  preloadStatus = 'loading',
  preloadProgress,
  onConfirm,
}) {
  const [selected, setSelected] = useState(() => (
    QUALITY_PRESETS.some((preset) => preset.id === recommended) ? recommended : 'balanced'
  ));
  const confirmRef = useRef(null);
  const optionsRef = useRef([]);
  const percent = Math.max(0, Math.min(100, preloadProgress?.percent ?? 0));

  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true });
  }, []);

  function onRadioKeyDown(event, index) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const nextIndex = (index + step + QUALITY_PRESETS.length) % QUALITY_PRESETS.length;
    setSelected(QUALITY_PRESETS[nextIndex].id);
    optionsRef.current[nextIndex]?.focus();
  }

  return (
    <div className="asset-download-backdrop graphics-setup-backdrop" role="dialog" aria-modal="true" aria-labelledby="graphics-setup-title">
      <section className="asset-download-card graphics-setup-card">
        <p className="asset-download-eyebrow">S’WORD MASTER · 모험 채비</p>
        <h2 id="graphics-setup-title">3D 그래픽 품질 선택</h2>
        <p className="asset-download-status">
          기기에 맞는 화질을 직접 골라 주세요. 언제든 설정에서 바꿀 수 있어요.
        </p>

        <div className="graphics-setup-grid" role="radiogroup" aria-label="3D 그래픽 품질 선택">
          {QUALITY_PRESETS.map((preset, index) => {
            const active = selected === preset.id;
            const isRecommended = recommended === preset.id;
            return (
              <button
                key={preset.id}
                ref={(node) => { optionsRef.current[index] = node; }}
                type="button"
                role="radio"
                aria-checked={active}
                data-quality-choice={preset.id}
                className={`graphics-preset-card${active ? ' is-selected' : ''}`}
                onClick={() => setSelected(preset.id)}
                onDoubleClick={() => onConfirm(preset.id)}
                onKeyDown={(event) => onRadioKeyDown(event, index)}
              >
                <span className="graphics-preset-head">
                  <strong>{preset.label}</strong>
                  <span className="graphics-preset-badges">
                    <span className="graphics-preset-tag">{preset.tag}</span>
                    {isRecommended && <span className="graphics-preset-recommended">기기 추천</span>}
                  </span>
                </span>
                <span className="graphics-preset-devices">{preset.devices}</span>
                <span className="graphics-preset-summary">{preset.summary}</span>
              </button>
            );
          })}
        </div>

        <div className="graphics-setup-preload" role="status">
          {preloadReady ? (
            <span className="graphics-setup-preload-ready">3D 자산 준비 완료 · 선택하면 바로 시작돼요</span>
          ) : preloadStatus === 'error' ? (
            <span>자산 다운로드는 품질 선택 후 다시 시도할 수 있어요</span>
          ) : (
            <>
              <div className="graphics-setup-preload-row">
                <span>{preloadProgress?.label ?? '3D 자산 미리 받는 중…'}</span>
                <strong>{percent}%</strong>
              </div>
              <div className="asset-download-track graphics-setup-track" aria-hidden="true">
                <div className="asset-download-fill" style={{ width: `${percent}%` }} />
              </div>
            </>
          )}
        </div>

        <div className="asset-download-actions graphics-setup-actions">
          <button
            ref={confirmRef}
            type="button"
            className="game-primary"
            onClick={() => onConfirm(selected)}
          >
            {QUALITY_PRESETS.find((preset) => preset.id === selected)?.label} 품질로 시작하기
          </button>
        </div>
      </section>
    </div>
  );
}
