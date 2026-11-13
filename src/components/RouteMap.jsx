import { useLayoutEffect, useRef, useState } from 'react';
import { NODE_TYPES } from '../game/catalog.js';
import { ROUTE_LOOK, routePoint } from '../game/routeMap.js';
import GameIcon from './ui/GameIcon.jsx';
import './routeMap.css';

export const ROUTE_STATUS_TEXT = {
  current: '현재 위치', visited: '지나온 곳', reachable: '지금 갈 수 있음',
  ahead: '앞으로 갈 수 있는 곳', missed: '지나친 곳', closed: '이번 길로는 갈 수 없음',
};
// 지나온 길과 지금 고를 길이 다른 선에 가리지 않도록 나중에 그린다.
const EDGE_LAYER = { closed: 0, ahead: 1, traveled: 2, next: 3 };

// 타이틀 화면의 기사(보라 깃털·밝은 투구·주황 목가리개)를 닮은 작은 말.
function KnightToken() {
  return <svg className="route-knight" viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 10C15 4 19 1.5 24 2.5c-2.2 1.6-3.2 3.8-3.6 7.5Z" fill="#7d5bd0" stroke="#0e0913" strokeWidth="1.4" strokeLinejoin="round" />
    <rect x="7.5" y="9" width="17" height="16" rx="5" fill="#e7def1" stroke="#0e0913" strokeWidth="1.6" />
    <rect x="10.5" y="14.5" width="11" height="4" rx="1.6" fill="#221a2b" />
    <rect x="9" y="24" width="14" height="5" rx="2" fill="#f08e44" stroke="#0e0913" strokeWidth="1.4" />
  </svg>;
}

// 처음 하는 사람도 한눈에 읽을 수 있는 평면 경로 지도. 이동 규칙은 바꾸지 않고 표시만 담당한다.
export default function RouteMap({ map, routes, highlight, destination, onHighlight, onChoose }) {
  const board = useRef(null);
  const [horizontal, setHorizontal] = useState(false);
  useLayoutEffect(() => {
    const element = board.current;
    if (!element) return undefined;
    const fit = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width && height) setHorizontal(width > height * 1.35);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const at = (node) => routePoint(node, map.floors, horizontal);
  const order = new Map(routes.map((node, index) => [node.id, index + 1]));
  const focus = destination?.id ?? highlight;
  const hero = at(destination ?? map.here);
  const entrance = at(map.entrance);
  const edges = [...map.edges].sort((a, b) => EDGE_LAYER[a.status] - EDGE_LAYER[b.status]);
  return <div ref={board} className={`route-map${horizontal ? ' is-horizontal' : ' is-vertical'}${destination ? ' is-moving' : ''}`}
    role="group" aria-label={`던전 지도, 현재 ${map.here.floor < 0 ? '입구' : `${map.here.floor + 1}층`}`}>
    <svg className="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {edges.map((edge) => {
        const a = at(edge.from), b = at(edge.to);
        const focused = edge.status === 'next' && edge.to.id === focus;
        return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke"
          className={`route-edge edge-${edge.status}${focused ? ' is-focused' : ''}`} />;
      })}
    </svg>
    {Array.from({ length: map.floors }, (_, floor) => {
      const p = at({ floor, lane: 0 });
      return <span key={floor} className="route-floor" aria-hidden="true"
        style={horizontal ? { left: `${p.x}%` } : { top: `${p.y}%` }}>{floor + 1}층</span>;
    })}
    <span className="route-start" aria-hidden="true" style={{ left: `${entrance.x}%`, top: `${entrance.y}%` }} />
    <span className="route-entrance" aria-hidden="true" style={{ left: `${entrance.x}%`, top: `${entrance.y}%` }}>입구</span>
    {map.nodes.map((node) => {
      const look = ROUTE_LOOK[node.type];
      const p = at(node);
      const number = order.get(node.id);
      const selectable = node.status === 'reachable' && !destination;
      return <button key={node.id} type="button" tabIndex={-1} data-route-node={node.id}
        className={`route-node tone-${look.tone} is-${node.status}${focus === node.id ? ' is-highlighted' : ''}${destination?.id === node.id ? ' is-destination' : ''}`}
        style={{ left: `${p.x}%`, top: `${p.y}%` }} aria-disabled={!selectable}
        aria-label={`${node.floor + 1}층 ${NODE_TYPES[node.type].name}, ${ROUTE_STATUS_TEXT[node.status]}${number ? `, ${number}번 길` : ''}`}
        onMouseEnter={() => onHighlight(node.id)} onMouseLeave={() => onHighlight(null)}
        onClick={() => { if (selectable) onChoose(node); }}>
        <GameIcon name={look.icon} />
        {number && <b className="route-node-order" aria-hidden="true">{number}</b>}
        {node.status === 'visited' && <i className="route-node-check" aria-hidden="true">✓</i>}
        <span className="route-node-label">{NODE_TYPES[node.type].name}</span>
      </button>;
    })}
    <span className="route-hero" style={{ left: `${hero.x}%`, top: `${hero.y}%` }} aria-hidden="true">
      <KnightToken /><i>나</i>
    </span>
  </div>;
}

export function RouteLegend() {
  return <div className="route-legend" aria-label="지도 기호">
    {Object.entries(ROUTE_LOOK).map(([type, look]) => <span key={type} className={`route-legend-item tone-${look.tone}`}>
      <span className="route-legend-tile"><GameIcon name={look.icon} /></span>{NODE_TYPES[type].name}</span>)}
    <span className="route-legend-item legend-next"><span className="route-legend-tile" aria-hidden="true" />갈 수 있는 곳</span>
    <span className="route-legend-item legend-traveled"><i aria-hidden="true" />지나온 길</span>
  </div>;
}
