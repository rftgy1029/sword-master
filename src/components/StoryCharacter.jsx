export default function StoryCharacter({ character, sheathed = false, ...props }) {
  if (character === '작은 슬라임') return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#101d24" d="M4 42h32v4H4Z" />
      <path fill="#6399aa" d="M12 19h16v4h5v6h4v13H3V29h4v-6h5Z" />
      <path fill="#8fc2cb" d="M12 23h15v4H14v4H8v-4h4Z" />
      <path fill="#acd7d5" d="M13 24h7v3h-7Z" />
      <path fill="#1e3c48" d="M11 32h5v4h-5Zm13 0h5v4h-5Zm-7 8h7v2h-7Z" />
      <path fill="#426f88" d="M4 40h32v3H4Z" />
    </svg>
  );
  if (character === '모모') return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#111d1a" d="M4 42h32v4H4Z" />
      <path fill="#689a71" d="M8 25h24v4h4v14H4V29h4Z" />
      <path fill="#93bd87" d="M10 27h20v4h-7v4H8v-4h2Z" />
      <path fill="#d8b366" d="M11 14h4v4h4v-6h4v6h4v-4h4v11H11Z" />
      <path fill="#fae1a0" d="M14 22h14v3H14Z" />
      <path fill="#202f28" d="M12 33h3v4h-3Zm13 0h3v4h-3Zm-7 7h5v2h-5Z" />
    </svg>
  );
  if (character === '광고 괴물') return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#c59862" d="M17 2h6v7h-6Z" />
      <path fill="#68476e" d="M4 9h32v25H4Z" /><path fill="#e6c984" d="M7 12h26v19H7Z" />
      <path fill="#372c46" d="M10 15h20v13H10Z" />
      <path fill="#f4c8a2" d="M13 18h4v4h-4Zm10 0h4v4h-4Zm-8 7h10v2H15Z" />
      <path fill="#a37788" d="M0 18h4v20H0Zm36 0h4v20h-4ZM9 34h6v12H9Zm16 0h6v12h-6Z" />
    </svg>
  );
  if (character === '풍선 몬스터') return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#a886a3" d="M11 5h18v4h5v22h-5v5H11v-5H6V9h5Z" />
      <path fill="#c5a4b9" d="M12 9h8v5h-8Z" /><path fill="#343747" d="M12 19h4v5h-4Zm12 0h4v5h-4Zm-7 10h7v2h-7Z" />
      <path fill="#9da588" d="M18 36h4v4h-4Zm1 4h2v7h-2Z" />
    </svg>
  );
  if (character === '골목 몬스터') return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#8f7ba4" d="M9 9h5v6h12V9h5v10h4v21H5V19h4Z" />
      <path fill="#c9b4c9" d="M10 22h7v6h-7Zm13 0h7v6h-7Z" /><path fill="#343343" d="M13 23h3v4h-3Zm11 0h3v4h-3Zm-10 9h12v3H14Z" />
      <path fill="#6d627e" d="M5 40h12v5H5Zm18 0h12v5H23Z" />
    </svg>
  );
  if (!['용사', '니아'].includes(character)) return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#64818a" d="M12 6h16v5h5v13H7V11h5Zm-2 22h20v16H10Z" />
      <path fill="#c5b291" d="M13 14h14v12H13Z" /><path fill="#343f3f" d="M15 18h3v3h-3Zm8 0h3v3h-3Z" />
      <path fill="#495e65" d="M5 31h5v12H5Zm25 0h5v12h-5Z" />
      <path fill="#7e8c81" d="M12 44h6v4h-6Zm10 0h6v4h-6Z" />
    </svg>
  );
  const nia = character === '니아';
  return (
    <svg viewBox="0 0 40 48" {...props} aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#111d1a" d="M5 45h30v3H5Z" />
      <path fill={nia ? '#a97683' : '#705442'} d="M13 3h14v3h4v12H10V7h3Z" />
      <path fill="#d4b889" d="M17 10h13v10H17Z" /><path fill="#262a29" d="M27 12h2v3h-2Z" />
      <path fill={nia ? '#d0b18b' : '#a16b4f'} d="M12 20h18v5H12Z" />
      <path fill={nia ? '#799caa' : '#68715a'} d="M15 24h14v14H15Z" />
      <path fill={nia ? '#466c7a' : '#8e5e49'} d="M11 24h5v15H6v-5h3v-5h2Z" />
      <path fill="#c0b17e" d="M26 25h4v10h-4Z" />
      <path fill={nia ? '#c2c4ba' : '#403d33'} d="M15 38h5v7h-7v-3h2Zm9 0h5v7h-7v-3h2Z" />
      {nia ? <path fill="#e7c17a" d="M30 21h3v11h-3Zm-1-4h5v6h-5Z" />
        : !sheathed && <path fill="#bec5af" d="m30 31 7-9 2 2-7 9Zm-2 4 2-3 2 2-2 3Z" />}
    </svg>
  );
}
