export default function EnemyHealth({ enemy, percent, kind }) {
  const [x, y] = { slime: [455, 180], balloon: [500, 122], alley: [505, 179], boss: [496, 96] }[kind];
  return <div className={`enemy-health enemy-health-${kind}`} role="progressbar"
    aria-label={`${enemy} 남은 체력`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}%`}>
    <svg viewBox={kind === 'slime' ? '110 100 430 200' : '90 65 500 235'} aria-hidden="true">
      <g transform={`translate(${x} ${y})`}>
        <text className="enemy-health-value" y="-9" textAnchor="middle">HP {percent}%</text>
        <rect className="enemy-health-track" x="-48" width="96" height="6" />
        <rect className="enemy-health-fill" x="-47" y="1" width={94 * percent / 100} height="4" />
      </g>
    </svg>
  </div>;
}
