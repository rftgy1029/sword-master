// S’WORD의 아포스트로피(’)를 작은 칼로 바꾼 로고. "S + word = sword" 말장난을 글자 모양으로 보여 준다.
export default function SwordLogo({ className = '' }) {
  return <h1 className={`sword-logo ${className}`} aria-label="S’word Master">
    <span className="logo-line" aria-hidden="true">
      <span>S</span>
      <svg className="logo-sword" viewBox="0 0 10 22" shapeRendering="crispEdges">
        <path className="logo-blade" d="M4 0h2v1h1v11H3V1h1Z" />
        <path className="logo-shine" d="M5 1h1v11H5Z" />
        <path className="logo-guard" d="M0 12h10v2H0Z" />
        <path className="logo-grip" d="M4 14h2v5H4Z" />
        <path className="logo-guard" d="M3 19h4v3H3Z" />
      </svg>
      <span>WORD</span>
    </span>
    <span className="logo-line logo-master" aria-hidden="true">MASTER</span>
  </h1>;
}
