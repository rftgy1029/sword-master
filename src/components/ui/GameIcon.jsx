const paths = {
  strike: 'M7 25 26 6l1 8-12 12M7 19l6 6M5 28l4-4',
  guard: 'M16 3 5 7v9c0 7 11 13 11 13s11-6 11-13V7ZM16 8v14M10 14h12',
  heavy: 'M9 26 24 5l3 8-12 15M6 19l11 8M5 29l5-4M19 29l3-4 5 2',
  twin: 'M18 4A12 12 0 1 0 28 23 12 12 0 0 1 18 4ZM12 8A8 8 0 1 0 21 22',
  heal: 'M16 3S5 15 5 21a11 11 0 0 0 22 0C27 15 16 3 16 3ZM16 13v12M10 19h12',
  empower: 'M18 3c2 9-6 9-2 15 2-4 6-4 7-8 8 12 3 20-7 20S2 21 8 12c0 7 6 7 4 0Z',
  weaken: 'M11 5 5 10v12l11 7 11-7V10L21 5M11 13l10 8M21 13l-10 8M16 2v5',
  focus: 'M2 16s5-9 14-9 14 9 14 9-5 9-14 9S2 16 2 16ZM21 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
  flow: 'M3 11h17c8 0 6-10 0-7M3 17h23c7 0 6 10 0 8M6 23h10',
  flare: 'M4 9c10 0 10 14 24 14M4 16c10 0 10 14 24 14M4 2c10 0 10 14 24 14',
  nova: 'M16 2v5M16 25v5M2 16h5M25 16h5M6 6l4 4M22 22l4 4M6 26l4-4M22 10l4-4M16 9l7 7-7 7-7-7Z',
  oath: 'M5 8l5 6 6-10 6 10 5-6-3 17H8ZM9 29h14M12 20h8',
  book: 'M16 7C11 3 5 4 3 5v22c5-2 9-1 13 2 4-3 8-4 13-2V5c-4-1-9-2-13 2ZM16 7v22',
  spark: 'M16 2 19 12 30 16 19 20 16 30 12 20 2 16 12 12Z',
  // 던전 지도의 장소 표시
  swords: 'M5 5l15 15M17 23l6-6M21 21l5 5M27 5 12 20M9 17l6 6M11 21l-5 5',
  horns: 'M7 4c0 6 2 9 5 10M25 4c0 6-2 9-5 10M9 18a7 7 0 0 1 14 0v4l-3 2v4h-8v-4l-3-2ZM13 19h1M18 19h1M14 28v-3M18 28v-3',
  chest: 'M5 14h22v13H5ZM5 14c0-6 4-8 11-8s11 2 11 8M5 18h22M14 16h4v5h-4Z',
  campfire: 'M16 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-3 2-4 3-7 1 3 3 3 3 0ZM5 27l22-5M5 22l22 5',
  anvil: 'M4 10h18c0 4 3 6 6 6v2h-8l2 6H10l2-6H8c-3 0-4-4-4-8ZM8 28h16',
};

export default function GameIcon({ name = 'spark', className = '', ...props }) {
  return <svg className={`game-icon ${className}`} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] ?? paths.spark} /></svg>;
}
