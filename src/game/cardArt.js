export const CARD_ART = Object.freeze({
  strike: new URL('../../assets/cards/strike.webp', import.meta.url).href,
  guard: new URL('../../assets/cards/guard.webp', import.meta.url).href,
  heavy: new URL('../../assets/cards/heavy.webp', import.meta.url).href,
  twin: new URL('../../assets/cards/twin.webp', import.meta.url).href,
  heal: new URL('../../assets/cards/heal.webp', import.meta.url).href,
  empower: new URL('../../assets/cards/empower.webp', import.meta.url).href,
  weaken: new URL('../../assets/cards/weaken.webp', import.meta.url).href,
  focus: new URL('../../assets/cards/focus.webp', import.meta.url).href,
  flow: new URL('../../assets/cards/flow.webp', import.meta.url).href,
  flare: new URL('../../assets/cards/flare.webp', import.meta.url).href,
  nova: new URL('../../assets/cards/nova.webp', import.meta.url).href,
  oath: new URL('../../assets/cards/oath.webp', import.meta.url).href,
});

export function cardArtUrl(type) {
  return CARD_ART[type] ?? null;
}
