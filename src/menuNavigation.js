// A window/tab switch or a click on the scene can leave focus on the page body.
// Listen on the document so the next menu key recovers focus from there.
export function listenForMenuNavigation(document, { menu, buttons, selected, onSelect }) {
  let current = selected;

  function navigate(event) {
    if (document.hidden || event.defaultPrevented || event.isComposing ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const background = event.target === document.body || event.target === document.documentElement;
    // Leave dialogs, inputs and other controls in charge of their own keys.
    if (!background && !menu.contains(event.target)) return;

    const next = {
      ArrowDown: (current + 1) % buttons.length,
      ArrowUp: (current - 1 + buttons.length) % buttons.length,
      Home: 0,
      End: buttons.length - 1,
    }[event.key];

    if (next !== undefined) {
      event.preventDefault();
      current = next;
      onSelect(next);
      buttons[next]?.focus({ preventScroll: true });
      buttons[next]?.scrollIntoView({ block: 'nearest' });
    } else if (background && !event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      buttons[current]?.focus({ preventScroll: true });
      buttons[current]?.click();
    }
  }

  document.addEventListener('keydown', navigate);
  return () => document.removeEventListener('keydown', navigate);
}
