// Ignore held keys and browser shortcuts. Default max=4 covers 4 quiz choices; hand passes 5.
export function cardShortcutIndex(event, max = 4) {
  if (event.repeat || event.isComposing || event.defaultPrevented ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const limit = Math.max(1, Math.min(9, max));
  const numpad = /^Numpad([1-9])$/.exec(event.code);
  const digit = /^[1-9]$/.exec(event.key);
  const number = numpad ? Number(numpad[1]) : digit ? Number(digit[0]) : 0;
  return number >= 1 && number <= limit ? number - 1 : null;
}

// In 'single' mode, confirm right away with a brief highlight.
// In 'double' mode, focus on the first press and confirm on the second press while focused.
export function confirmShortcut(state, token, element, action, { mode = 'double' } = {}) {
  if (!element || element.disabled || state.current?.pending) return;
  if (mode !== 'single' && (state.current?.token !== token || document.activeElement !== element)) {
    state.current = { token };
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }
  if (mode === 'single') {
    element.focus?.({ preventScroll: true });
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.querySelector('.app')?.dataset.backgroundMotion === 'off';
  const delay = reduced ? 0 : mode === 'single' ? 90 : 180;
  if (delay === 0) {
    state.current = null;
    action();
    return;
  }
  state.current = { token, pending: true };
  element.classList.add('shortcut-confirming');
  const timer = setTimeout(() => {
    element.classList.remove('shortcut-confirming');
    state.current = null;
    action();
  }, delay);
  state.current.timer = timer;
}

export function cancelShortcut(state) {
  if (state.current?.timer) clearTimeout(state.current.timer);
  state.current = null;
}
