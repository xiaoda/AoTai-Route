import { TERRAIN_SIZE, trailX } from './terrain';

export interface FlatPoint { x: number; z: number }
export interface RoutePoint extends FlatPoint { distance: number }
/** 测试样段；不是 GPS 轨迹。累计距离为水平弧长，与徒步里程口径一致。 */
export const ROUTE: readonly RoutePoint[] = (() => {
  const points: RoutePoint[] = [];
  for (let z = 62; z >= -116; z--) {
    const x = trailX(z), previous = points.at(-1);
    points.push({ x, z, distance: previous ? previous.distance + Math.hypot(x - previous.x, z - previous.z) : 0 });
  }
  return points;
})();
export const routeLength = ROUTE.at(-1)!.distance;
export const clampDistance = (d: number) => Number.isFinite(d) ? Math.max(0, Math.min(routeLength, d)) : 0;

export function pointAtDistance(distance: number): RoutePoint {
  const d = clampDistance(distance);
  let low = 0, high = ROUTE.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (ROUTE[mid].distance <= d) low = mid; else high = mid;
  }
  const a = ROUTE[low], b = ROUTE[high], t = (d - a.distance) / (b.distance - a.distance);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, distance: d };
}

export function projectToRoute(point: FlatPoint): { distance: number; offset: number } {
  let best = Infinity, distance = 0;
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1], b = ROUTE[i], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
    const offset = Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
    if (offset < best) { best = offset; distance = a.distance + t * (b.distance - a.distance); }
  }
  return { distance, offset: best };
}

/** 240×240 SVG；280 米全场景边界内缩 16 px；-Z 为图上方。 */
export function worldToMap(point: FlatPoint) {
  return { x: 16 + (point.x + TERRAIN_SIZE / 2) / TERRAIN_SIZE * 208, y: 16 + (point.z + TERRAIN_SIZE / 2) / TERRAIN_SIZE * 208 };
}
