import { useEffect, useRef } from 'react';

export default function MenuDialog({ title, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (title !== null && !dialog.current.open) dialog.current.showModal();
  }, [title]);

  return (
    <dialog ref={dialog} aria-labelledby="dialog-title" aria-describedby="dialog-description"
      onClose={onClose}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) event.currentTarget.close();
      }}>
      <h2 id="dialog-title">{title}</h2>
      <p id="dialog-description">아직 준비 중인 메뉴예요.<br />지금은 시작 화면과 메뉴 선택을 둘러볼 수 있어요.</p>
      <form method="dialog"><button className="return-button" autoFocus>돌아가기</button></form>
    </dialog>
  );
}
