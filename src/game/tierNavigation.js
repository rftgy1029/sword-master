export function navigateTiers(event, { tiers, start, select }) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const index = tiers.indexOf(event.target);
  if (event.target === start) {
    if (event.repeat && ['Enter', ' '].includes(event.key)) event.preventDefault();
    if (event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      (tiers.find((button) => button.getAttribute('aria-pressed') === 'true') ?? tiers[0])?.focus();
    }
    return;
  }
  if (index < 0) return;
  if (['Enter', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); event.stopPropagation();
    if (event.repeat) return;
    select(event.target.dataset.tier); start?.focus();
  } else {
    const next = { ArrowLeft: (index + tiers.length - 1) % tiers.length, ArrowRight: (index + 1) % tiers.length,
      Home: 0, End: tiers.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault(); event.stopPropagation();
    tiers[next]?.focus(); select(tiers[next]?.dataset.tier);
  }
}
