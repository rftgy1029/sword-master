import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS } from '../settings.js';

const TABS = [
  { id: 'display', label: '화면·연출', number: '01' },
  { id: 'controls', label: '조작 안내', number: '02' },
];

function SettingOptions({ name, title, description, choices, value, onChange }) {
  return (
    <fieldset className="setting-field">
      <legend className="sr-only">{title}</legend>
      <div className="setting-field-content">
        <div><h4 aria-hidden="true">{title}</h4><p id={`${name}-description`}>{description}</p></div>
        <div className="setting-options">
          {choices.map(([option, label]) => (
            <label className="setting-option" key={option}>
              <input type="radio" name={name} value={option} checked={value === option}
                aria-describedby={`${name}-description`} onChange={() => onChange(name, option)} />
              <span><span className="option-dot" aria-hidden="true" />{label}</span>
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

export default function SettingsDialog({ settings, onChange, onReset, saved, onClose }) {
  const dialog = useRef(null);
  const tabButtons = useRef([]);
  const panel = useRef(null);
  const [tab, setTab] = useState('display');
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState('');
  const [resetNotice, setResetNotice] = useState(false);
  const fullscreenSupported = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  const defaultsActive = Object.keys(DEFAULT_SETTINGS).every((key) => settings[key] === DEFAULT_SETTINGS[key]);

  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
    tabButtons.current[0]?.focus({ preventScroll: true });
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  function navigateTabs(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const current = TABS.findIndex(({ id }) => id === tab);
    const next = {
      ArrowDown: (current + 1) % TABS.length,
      ArrowUp: (current - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      setTab(TABS[next].id);
      tabButtons.current[next]?.focus();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      (panel.current.querySelector('input:checked, button:not(:disabled)') ?? panel.current).focus();
    }
  }

  async function toggleFullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFullscreenError('전체 화면을 전환하지 못했어요. 브라우저 설정을 확인해 주세요.');
    }
  }

  function changeSetting(name, value) {
    setResetNotice(false);
    onChange(name, value);
  }

  function resetSettings() {
    onReset();
    setResetNotice(true);
    setFullscreenError('');
    tabButtons.current[TABS.findIndex(({ id }) => id === tab)]?.focus({ preventScroll: true });
  }

  return (
    <dialog className="settings-dialog" ref={dialog} aria-labelledby="settings-title" onClose={onClose}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget &&
          (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
          event.currentTarget.close();
        }
      }}>
      <header className="settings-header">
        <div>
          <p className="settings-eyebrow"><span aria-hidden="true">✦</span> S’WORD MASTER</p>
          <h2 id="settings-title">설정</h2>
          <p className="settings-intro">나에게 편한 화면으로 모험을 준비하세요.</p>
        </div>
        <button className="settings-close" aria-label="설정 닫기" onClick={() => dialog.current.close()}>
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div className="settings-body">
        <aside className="settings-sidebar">
          <div className="settings-tabs" role="tablist" aria-label="설정 분류" aria-orientation="vertical"
            onKeyDown={navigateTabs}>
            {TABS.map(({ id, label, number }, index) => (
              <button key={id} ref={(element) => { tabButtons.current[index] = element; }}
                type="button" role="tab" id={`settings-tab-${id}`} aria-controls={`settings-panel-${id}`}
                aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} autoFocus={index === 0}
                className={`settings-tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
                <span className="tab-number" aria-hidden="true">{number}</span>
                <span>{label}</span><span className="tab-marker" aria-hidden="true">▸</span>
              </button>
            ))}
          </div>
          <p className="settings-sidebar-note">작은 변화로<br />더 편안한 모험을.</p>
        </aside>

        <section ref={panel} className="settings-panel" role="tabpanel" id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`} tabIndex={0}>
          {tab === 'display' ? (
            <>
              <div className="settings-section-heading"><h3>화면·연출</h3><span>DISPLAY</span></div>
              <SettingOptions name="textSize" title="글자 크기" description="메뉴와 안내 글자의 크기를 조절해요."
                choices={[[ 'normal', '보통' ], [ 'large', '크게' ], [ 'larger', '아주 크게' ]]}
                value={settings.textSize} onChange={changeSetting} />
              <SettingOptions name="backgroundMotion" title="배경 움직임" description="망토와 횃불의 움직임을 조절해요."
                choices={[[ 'normal', '기본' ], [ 'reduced', '줄이기' ], [ 'off', '끄기' ]]}
                value={settings.backgroundMotion} onChange={changeSetting} />
              <SettingOptions name="selectionEffect" title="메뉴 선택 효과" description="선택한 항목의 밝기 변화를 조절해요."
                choices={[[ 'breathe', '천천히 밝아짐' ], [ 'static', '고정' ]]}
                value={settings.selectionEffect} onChange={changeSetting} />
              <SettingOptions name="soundEffects" title="전투 효과음" description="슬라임전의 검격·타격·방어 소리를 켜거나 꺼요."
                choices={[[ 'on', '켜기' ], [ 'off', '끄기' ]]}
                value={settings.soundEffects} onChange={changeSetting} />
              <div className="setting-fullscreen">
                <div><h4>전체 화면</h4><p>{fullscreenSupported ? '현재 창에만 적용돼요. Esc로 나올 수 있어요.' : '이 브라우저에서는 전체 화면을 지원하지 않아요.'}</p></div>
                <button className="settings-action" disabled={!fullscreenSupported} aria-pressed={fullscreen}
                  onClick={toggleFullscreen}>{fullscreen ? '전체 화면 나가기' : '전체 화면으로 전환'}<span aria-hidden="true">↗</span></button>
              </div>
              {fullscreenError ? <p className="settings-error" role="alert">{fullscreenError}</p> : null}
              <div className="settings-preview" aria-label="글자와 메뉴 효과 미리보기">
                <span className="preview-label">미리보기</span>
                <span className="selection-sample"><span aria-hidden="true">▸</span> 새로운 모험을 시작하세요.</span>
              </div>
              <p className="motion-note">기기의 ‘움직임 줄이기’가 켜져 있으면 움직이는 효과를 자동으로 멈춰요.</p>
            </>
          ) : (
            <>
              <div className="settings-section-heading"><h3>조작 안내</h3><span>CONTROLS</span></div>
              <p className="controls-intro">키보드와 클릭으로 설정할 수 있어요.</p>
              <dl className="controls-guide">
                <div><dt><kbd>↑</kbd><kbd>↓</kbd></dt><dd>메뉴와 왼쪽 분류 이동</dd></div>
                <div><dt><kbd>Tab</kbd><kbd>Shift + Tab</kbd></dt><dd>다음 항목과 이전 항목으로 이동</dd></div>
                <div><dt><kbd>←</kbd><kbd>→</kbd></dt><dd>선택 항목의 설정값 변경</dd></div>
                <div><dt><kbd>Enter</kbd><kbd>Space</kbd></dt><dd>버튼 실행 또는 항목 선택</dd></div>
                <div><dt><kbd>Esc</kbd></dt><dd>설정을 닫고 타이틀로 돌아가기</dd></div>
              </dl>
              <div className="controls-tip"><span aria-hidden="true">✦</span><p>설정을 닫으면 타이틀의 ‘설정’ 메뉴에서 바로 이어서 조작할 수 있어요.</p></div>
            </>
          )}
        </section>
      </div>

      <footer className="settings-footer">
        <p className={`settings-save-status${saved === false ? ' is-unavailable' : ''}`} role="status">
          <span className="save-indicator" aria-hidden="true" />
          {saved === false ? '설정을 저장할 수 없어요. 이번 접속 중에만 유지돼요.' : resetNotice ? '기본 설정으로 되돌렸어요.' : '변경한 설정은 자동으로 저장돼요.'}
        </p>
        <div className="settings-footer-actions">
          <button className="settings-reset" disabled={defaultsActive} onClick={resetSettings}>기본값 복원</button>
          <button className="return-button" onClick={() => dialog.current.close()}>돌아가기 <span aria-hidden="true">↵</span></button>
        </div>
      </footer>
    </dialog>
  );
}
