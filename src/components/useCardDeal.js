import { useLayoutEffect, useRef, useState } from 'react';

export function useCardDeal({ section, canvas, cards, turn, drawCount, suspended, animateOpening, motionPreference, onOpeningDone }) {
  const [hidden, setHidden] = useState(() => animateOpening ? cards.map((card) => card.uid) : []);
  const [busy, setBusy] = useState(animateOpening);
  const previous = useRef(animateOpening ? null : { turn, drawCount, ids: cards.map((card) => card.uid) });
  const controller = useRef(null);
  const loader = useRef(null);
  const drawing = useRef(false);
  const initial = useRef(previous.current);
  const generation = useRef(0);
  const alive = useRef(false);
  const onDone = useRef(onOpeningDone);
  onDone.current = onOpeningDone;
  const ids = cards.map((card) => card.uid).join('|');

  useLayoutEffect(() => {
    let cancelled = false;
    generation.current++;
    alive.current = true;
    loader.current = import('../game/cardDealScene.js').then(({ startCardDealScene }) => {
      if (cancelled) return null;
      controller.current = startCardDealScene(canvas.current);
      return controller.current;
    }).catch(() => null);
    return () => { cancelled = true; alive.current = false; drawing.current = false; previous.current = initial.current; controller.current?.destroy(); };
  }, [canvas]);

  useLayoutEffect(() => {
    if (suspended) {
      if (previous.current?.turn === turn) previous.current.ids = previous.current.ids.filter((uid) => cards.some((card) => card.uid === uid));
      return;
    }
    if (drawing.current) return;
    const currentGeneration = generation.current;
    const before = previous.current;
    const nextCards = !before || before.turn !== turn ? cards : cards.filter((card) => !before.ids.includes(card.uid));
    previous.current = { turn, drawCount, ids: cards.map((card) => card.uid) };
    const reduced = motionPreference !== 'normal' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!nextCards.length || reduced) {
      setHidden([]); setBusy(false); onDone.current?.(); return;
    }
    drawing.current = true;
    setBusy(true); setHidden(nextCards.map((card) => card.uid));
    const finish = () => {
      if (!alive.current || generation.current !== currentGeneration) return;
      drawing.current = false; setHidden([]); setBusy(false); onDone.current?.();
    };
    loader.current.then((renderer) => {
      if (!alive.current || generation.current !== currentGeneration || !renderer) return;
      const bounds = canvas.current.getBoundingClientRect();
      const point = (element) => {
        const box = element.getBoundingClientRect();
        return { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top, width: box.width, height: box.height };
      };
      const source = point(section.current.querySelector('.draw-pile'));
      const discard = point(section.current.querySelector('.discard-pile'));
      const targets = nextCards.map((card) => point(section.current.querySelector('[data-card-uid="' + card.uid + '"]')));
      return renderer.play({ cards: nextCards, targets, source, discard, reshuffle: !!before && before.drawCount < nextCards.length,
        onArrive: (uid) => { if (alive.current) setHidden((current) => current.filter((id) => id !== uid)); } });
    }).then(finish, finish);
  }, [ids, turn, drawCount, suspended, motionPreference, cards, canvas, section]);
  return { hidden, busy };
}
