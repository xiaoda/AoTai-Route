import { clampDistance, pointAtDistance, routeLength } from './route';
import { sampleTerrain, type TerrainData } from './terrain';

export type TravelMode = 'foot' | 'air';
export class AirTour {
  private travelled = 0;
  get distance() { return this.travelled; }
  get complete() { return this.travelled >= routeLength; }
  advance(delta: number, speed: number) {
    if (!Number.isFinite(delta) || delta <= 0 || !Number.isFinite(speed) || speed <= 0) return;
    this.travelled = clampDistance(this.travelled + Math.min(delta, 0.1) * Math.min(speed, 12));
  }
  seek(distance: number) { this.travelled = clampDistance(distance); }
  reset() { this.travelled = 0; }
  pose(terrain: TerrainData, altitude: number) {
    const point = pointAtDistance(this.travelled);
    const height = Number.isFinite(altitude) ? Math.max(10, Math.min(30, altitude)) : 10;
    // 固定朝向场景正前方（-Z），不再用路径切线驱动镜头左右转动。
    // 自由环顾由输入层叠加；路线和高度只影响相机位置。
    return { x: point.x, z: point.z, y: sampleTerrain(terrain, point.x, point.z) + height,
      yaw: 0 };
  }
}
