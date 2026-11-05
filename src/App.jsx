import { useEffect, useRef, useState } from 'react';
import TitleScene from './components/TitleScene.jsx';
import MenuDialog from './components/MenuDialog.jsx';
import SettingsDialog from './components/SettingsDialog.jsx';
import VocabularyDialog from './components/VocabularyDialog.jsx';
import { DEFAULT_SETTINGS, normalizeSettings, readSettings, saveSettings } from './settings.js';
import { listenForMenuNavigation } from './menuNavigation.js';

const MENU = [
  { label: '새 모험', description: '학습 범위를 고르고 새로운 모험을 시작하세요.' },
  { label: '단어장', description: '티어별 단어와 뜻, 유의어·반의어를 살펴보세요.' },
  { label: '오답 복습', description: '헷갈렸던 단어를 다시 만나 보세요.' },
  { label: '설정', description: '나에게 편한 학습 환경을 준비하세요.' },
];

export default function App() {
  const [selected, setSelected] = useState(0);
  const [openedMenu, setOpenedMenu] = useState(null);
  const [settings, setSettings] = useState(readSettings);
  const [settingsSaved, setSettingsSaved] = useState(null);
  const buttons = useRef([]);
  const menu = useRef(null);
  const opener = useRef(null);

  useEffect(() => { buttons.current[0]?.focus({ preventScroll: true }); }, []);
  useEffect(() => { setSettingsSaved(saveSettings(settings)); }, [settings]);
  useEffect(() => {
    if (openedMenu !== null) return;
    return listenForMenuNavigation(document, {
      menu: menu.current, buttons: buttons.current, selected, onSelect: setSelected,
    });
  }, [openedMenu, selected]);

  function focusMenu(index) {
    setSelected(index);
    buttons.current[index]?.focus({ preventScroll: true });
  }

  function closeMenu() {
    setOpenedMenu(null);
    opener.current?.focus({ preventScroll: true });
  }

  return (
    <div className="app" data-text-size={settings.textSize} data-selection-effect={settings.selectionEffect}>
      <main className="start-screen">
        <div className="title-layout">
          <section className="menu-column" aria-label="S’word Master 시작">
            <header className="brand">
              <svg className="brand-mark" viewBox="0 0 32 40" aria-hidden="true">
                <path d="M14 0h4v4h2v18h-2v4h8v4H18v6h2v4h-8v-4h2v-6H6v-4h8v-4h-2V4h2Z" />
                <path className="blade-highlight" d="M16 4h2v18h-2Z" />
              </svg>
              <div>
                <h1><span>S’WORD</span><span>MASTER</span></h1>
              </div>
            </header>
            <nav ref={menu} className="menu" aria-label="시작 메뉴">
              {MENU.map(({ label }, index) => (
                <div className={index === 0 ? 'adventure-actions' : 'menu-item'} key={label}>
                  <button
                    ref={(element) => { buttons.current[index] = element; }}
                    className={`menu-button${selected === index ? ' is-selected' : ''}`}
                    onFocus={() => setSelected(index)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === 'mouse' && openedMenu === null) focusMenu(index);
                    }}
                    onClick={(event) => {
                      if (openedMenu !== null) return;
                      setSelected(index);
                      opener.current = event.currentTarget;
                      setOpenedMenu(label);
                    }}
                  >
                    <span className="marker" aria-hidden="true">▸</span>
                    <span>{label}</span>
                    <span className="enter" aria-hidden="true">↵</span>
                  </button>
                  {index === 0 && (
                    <button className="menu-button continue-button" disabled>
                      <span className="marker" aria-hidden="true">▸</span>
                      <span>이어하기</span><small>저장된 기록 없음</small>
                    </button>
                  )}
                </div>
              ))}
            </nav>
            <p className="menu-description">{MENU[selected].description}</p>
          </section>
          <figure className="dungeon-scene">
            <TitleScene motionPreference={settings.backgroundMotion} />
            <figcaption><span className="location-marker" aria-hidden="true" />던전 입구</figcaption>
          </figure>
        </div>
        <footer className="screen-footer">
          <div className="hints">
            <span><kbd>↑ ↓</kbd> 이동</span>
            <span><kbd>Enter</kbd> 선택</span>
            <span><kbd>Esc</kbd> 닫기</span>
            <span className="pointer-hint">클릭으로 선택할 수 있어요</span>
          </div>
          <p className="version">미리보기 <span aria-hidden="true">/</span> v0.5</p>
        </footer>
      </main>
      {openedMenu === '설정' ? (
        <SettingsDialog settings={settings} saved={settingsSaved} onClose={closeMenu}
          onChange={(key, value) => setSettings((current) => normalizeSettings({ ...current, [key]: value }))}
          onReset={() => setSettings({ ...DEFAULT_SETTINGS })} />
      ) : openedMenu === '단어장' ? <VocabularyDialog onClose={closeMenu} />
        : <MenuDialog title={openedMenu} onClose={closeMenu} />}
    </div>
  );
}
