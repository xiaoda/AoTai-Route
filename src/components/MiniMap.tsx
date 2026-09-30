import type { Telemetry } from '../scene/Experience';
import type { TravelMode } from '../world/tour';
import { ROUTE, VIEWPOINT, pointAtDistance, routeLength, worldToMap } from '../world/route';
import { TERRAIN_SIZE, terrainHeight } from '../world/terrain';
import { ELEVATION_OFFSET } from '../world/elevation';

const line = (points: readonly { x: number; z: number }[]) => points.map((p, i) => {
  const m = worldToMap(p); return `${i ? 'L' : 'M'}${m.x.toFixed(2)},${m.y.toFixed(2)}`;
}).join(' ');
const routePath = line(ROUTE);
const viewpoint = worldToMap(VIEWPOINT);
const start = worldToMap(ROUTE[0]), end = worldToMap(ROUTE.at(-1)!);
// 从已打包 DEM 同源生成的 40 米等高线；路径仍为虚拟编排，不是现实导航。
function contours() {
  const paths: string[] = [];
  for (let level = 3200 - ELEVATION_OFFSET; level <= 3800 - ELEVATION_OFFSET; level += 40) {
    let path = '';
    for (let z = -TERRAIN_SIZE / 2; z < TERRAIN_SIZE / 2; z += 32) for (let x = -TERRAIN_SIZE / 2; x < TERRAIN_SIZE / 2; x += 32) {
      const corners = [{ x, z }, { x: x + 32, z }, { x: x + 32, z: z + 32 }, { x, z: z + 32 }];
      const crossings: { x: number; z: number }[] = [];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4], ha = terrainHeight(a.x, a.z), hb = terrainHeight(b.x, b.z);
        if ((ha < level) === (hb < level)) continue;
        const t = (level - ha) / (hb - ha);
        crossings.push({ x: a.x + t * (b.x - a.x), z: a.z + t * (b.z - a.z) });
      }
      for (let i = 0; i + 1 < crossings.length; i += 2) path += line(crossings.slice(i, i + 2));
    }
    paths.push(path);
  }
  return paths;
}
const terrainContours = contours();
const MapBase = <>
  <rect x="16" y="16" width="208" height="208" rx="2" fill="#243b32" stroke="#dfe9c325" />
  {[68, 120, 172].map(n => <path key={n} d={`M${n} 16V224 M16 ${n}H224`} stroke="#dfe9c310" />)}
  {terrainContours.map((d, i) => <path key={i} d={d} fill="none" stroke="#b4c29c" strokeOpacity=".19" strokeWidth=".7" />)}
  <path d={routePath} fill="none" stroke="#e8eadd" strokeOpacity=".48" strokeWidth="2" strokeDasharray="3 4" />
  <circle cx={start.x} cy={start.y} r="3" fill="#e8eadd" />
  <circle cx={end.x} cy={end.y} r="4" fill="#243b32" stroke="#d9e29f" strokeWidth="1.5" />
  <text x={start.x + 32} y={start.y + 4}>起点</text><text x={end.x + 32} y={end.y + 4}>终点</text>
  <circle cx={viewpoint.x} cy={viewpoint.y} r="4" fill="#c6a97b" /><text x={viewpoint.x + 10} y={viewpoint.y + 3}>石河 / 草甸</text>
  <path d="M204 50V30m-4 6 4-6 4 6" stroke="#d9e29f" fill="none" /><text x="200" y="24">北</text>
  <path d="M28 207v4h40.625v-4" stroke="#ced9c0" fill="none" /><text x="28" y="201">200 米</text>
</>;

export default function MiniMap({ telemetry: t, travel }: { telemetry: Telemetry; travel: TravelMode }) {
  const position = worldToMap(t), percent = Math.round(t.routeDistance / routeLength * 100);
  const passed = [...ROUTE.filter(p => p.distance < t.routeDistance), pointAtDistance(t.routeDistance)];
  return <aside className="mini-map" aria-label="实时小地图">
    <div className="map-heading"><h2>此刻，在这里</h2><span>{travel === 'air' ? '半空漫游' : '自由徒步'}</span></div>
    <svg viewBox="0 0 240 240" role="img" aria-label={`真实高程上的虚拟路径，${travel === 'air' ? '漫游进度' : '最近路段位置'} ${percent}%，视线朝向 ${Math.round(t.heading)} 度`}>
      {MapBase}
      {travel === 'air' && <path d={line(passed)} fill="none" stroke="#d9e29f" strokeWidth="2.5" />}
      <g data-testid="map-position" data-world-x={t.x} data-world-z={t.z} transform={`translate(${position.x} ${position.y})`}>
        <g data-testid="map-heading" transform={`rotate(${t.heading})`}>
          <path d="M0 0 -13 -25Q0 -33 13 -25Z" fill="#d9e29f" opacity=".18" />
          <path d="M0 -10 5 2 0 0 -5 2Z" fill="#f0f4cb" stroke="#1b3428" strokeWidth="1" />
        </g>
        <circle r="3" fill="#f0f4cb" stroke="#1b3428" strokeWidth="1" />
      </g>
    </svg>
    <div className="map-progress"><span>{travel === 'air' ? (t.complete ? '已到达终点' : '漫游进度') : '最近路段位置'}</span><strong>{percent}<small>%</small></strong></div>
    <div className="map-progress-track"><span style={{ width: `${percent}%` }} /></div>
    <p>{travel === 'air' ? `剩余 ${Math.max(0, routeLength - t.routeDistance).toFixed(0)} 米 · 视线方向随箭头` : `距路径 ${t.routeOffset.toFixed(0)} 米 · 箭头为视线方向`}</p>
    <div className="map-elevation"><span>DEM 地面高程</span><strong>{(terrainHeight(t.x,t.z)+ELEVATION_OFFSET).toFixed(0)} <small>米</small></strong></div>
    <div className="map-disclaimer">真实高程 · 虚拟路径 · 非导航<br /><a href="/terrain-sources.txt" target="_blank" rel="noreferrer">Mapzen / USGS · 数据与重建说明 ↗</a></div>
  </aside>;
}
