import { useEffect, useRef, useState } from 'react';
import TitleScene from './components/TitleScene.jsx';
import MenuDialog from './components/MenuDialog.jsx';

const MENU = ['새 모험', '단어장', '오답 복습', '설정'];

export default function App() {
  const [selected, setSelected] = useState(0);
  const [openedMenu, setOpenedMenu] = useState(null);
  const buttons = useRef([]);
  const opener = useRef(null);

  useEffect(() => { buttons.current[0]?.focus({ preventScroll: true }); }, []);

  function focusMenu(index) {
    setSelected(index);
    buttons.current[index]?.focus({ preventScroll: true });
  }

  function handleNavigation(event) {
    if (openedMenu !== null || event.altKey || event.ctrlKey || event.metaKey) return;
    const destinations = {
      ArrowDown: (selected + 1) % MENU.length,
      ArrowUp: (selected - 1 + MENU.length) % MENU.length,
      Home: 0,
      End: MENU.length - 1,
    };
    const next = destinations[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focusMenu(next);
    buttons.current[next]?.scrollIntoView({ block: 'nearest' });
  }

  function closeMenu() {
    setOpenedMenu(null);
    opener.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <TitleScene />
      <div className="scrim" aria-hidden="true" />
      <main className="start-screen">
        <div className="menu-column">
          <header>
            <p className="eyebrow">한 단어, 한 걸음</p>
            <h1>S’word Master</h1>
            <p className="subtitle">단어로 여는 던전</p>
          </header>
          <nav className="menu" aria-label="시작 메뉴" onKeyDown={handleNavigation}>
            <button className="menu-button" disabled>
              <span className="marker" aria-hidden="true">›</span>
              <span>이어하기<small>저장된 모험이 없습니다</small></span>
            </button>
            {MENU.map((label, index) => (
              <button
                key={label}
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
                <span className="marker" aria-hidden="true">›</span>
                <span>{label}</span>
                <span className="enter" aria-hidden="true">↵</span>
              </button>
            ))}
          </nav>
        </div>
        <footer>
          <div className="hints"><span><kbd>↑ ↓</kbd> 이동</span><span><kbd>Enter</kbd> 선택</span><span><kbd>클릭</kbd> 선택</span></div>
          <p className="version">시작 화면 미리보기 · v0.3</p>
        </footer>
      </main>
      <MenuDialog title={openedMenu} onClose={closeMenu} />
    </>
  );
}
