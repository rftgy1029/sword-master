// Only the first four hand positions have shortcuts. Ignore held keys and browser shortcuts.
export function cardShortcutIndex(event) {
  if (event.repeat || event.isComposing || event.defaultPrevented ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  const number = /^Numpad[1-4]$/.test(event.code) ? Number(event.code.slice(-1))
    : /^[1-4]$/.test(event.key) ? Number(event.key) : 0;
  return number ? number - 1 : null;
}

// Focus on the first press; the same key confirms only while that choice stays focused.
export function confirmShortcut(state, token, element, action) {
  if (!element || element.disabled || state.current?.pending) return;
  if (state.current?.token !== token || document.activeElement !== element) {
    state.current = { token };
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.querySelector('.app')?.dataset.backgroundMotion === 'off';
  state.current = { token, pending: true };
  element.classList.add('shortcut-confirming');
  const timer = setTimeout(() => {
    element.classList.remove('shortcut-confirming');
    state.current = null;
    action();
  }, reduced ? 0 : 180);
  state.current.timer = timer;
}

export function cancelShortcut(state) {
  if (state.current?.timer) clearTimeout(state.current.timer);
  state.current = null;
}
