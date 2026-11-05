export default function TierCrest({ tier, small = false }) {
  return (
    <svg className={`tier-crest tier-${tier}${small ? ' is-small' : ''}`} viewBox="0 0 24 28" aria-hidden="true">
      <path d="M3 2h18v15h-3v4h-3v3H9v-3H6v-4H3Z" />
      <path className="crest-inset" d="M6 5h12v10h-3v4H9v-4H6Z" />
      <path className="crest-star" d="M11 7h2v3h3v2h-3v3h-2v-3H8v-2h3Z" />
    </svg>
  );
}
