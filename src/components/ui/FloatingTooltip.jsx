import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * 마우스 호버, 터치 탭 토글, 키보드 초점/Esc 닫기를 일관되게 처리하는 툴팁 상태 훅.
 */
export function useTooltipTrigger(enabled = true) {
  const [open, setOpen] = useState(false);
  const host = useRef(null);
  const pointer = useRef('mouse');
  const fromPointer = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!enabled) setOpen(false);
  }, [enabled]);

  const hostProps = {
    ref: host,
    onPointerEnter: (event) => { if (enabled && event.pointerType !== 'touch') setOpen(true); },
    onPointerLeave: (event) => { if (event.pointerType !== 'touch') setOpen(false); },
  };

  const buttonProps = {
    'aria-expanded': open,
    'aria-describedby': open ? id : undefined,
    onPointerDown: (event) => { pointer.current = event.pointerType; fromPointer.current = true; },
    onFocus: () => { if (enabled && !fromPointer.current) setOpen(true); },
    onBlur: () => { fromPointer.current = false; setOpen(false); },
    onClick: (event) => {
      fromPointer.current = false;
      if (!enabled) return;
      setOpen((was) => (event.detail === 0 || pointer.current === 'touch' ? !was : true));
    },
    onKeyDown: (event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    },
  };

  return { open, setOpen, host, id, hostProps, buttonProps };
}

/**
 * 모험 대화창(또는 본문) 위에 떠 있는 툴팁.
 * 기준 요소 아래(공간이 부족하면 위)에 맞추고, 화면 가장자리 밖으로 나가지 않게 자른다.
 */
export default function FloatingTooltip({ anchor, id, className = '', onDismiss, children }) {
  const tooltip = useRef(null);
  const dialog = anchor.current?.closest('dialog');
  const container = dialog ?? document.body;

  useLayoutEffect(() => {
    const position = () => {
      if (!anchor.current || !tooltip.current) return;
      const box = dialog ? dialog.getBoundingClientRect() : { left: 0, top: 0 };
      const limitW = dialog ? dialog.clientWidth : window.innerWidth;
      const limitH = dialog ? dialog.clientHeight : window.innerHeight;
      const button = anchor.current.getBoundingClientRect();
      const popup = tooltip.current;
      const centered = button.left + button.width / 2 - popup.offsetWidth / 2 - box.left;
      const left = Math.max(10, Math.min(limitW - popup.offsetWidth - 10, centered));
      const below = button.bottom - box.top + 8;
      const top = below + popup.offsetHeight < limitH - 10 ? below : Math.max(10, button.top - box.top - popup.offsetHeight - 8);
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    position();
    window.addEventListener('resize', position);
    container.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      container.removeEventListener('scroll', position, true);
    };
  }, [anchor, container, dialog]);

  useEffect(() => {
    if (!onDismiss) return undefined;
    const outside = (event) => {
      if (!anchor.current?.contains(event.target) && !tooltip.current?.contains(event.target)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [anchor, onDismiss]);

  return createPortal(
    <span ref={tooltip} className={`status-tooltip is-floating ${className}`.trim()} id={id} role="tooltip">
      {children}
    </span>,
    container,
  );
}
