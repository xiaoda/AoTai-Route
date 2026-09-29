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
    const before = pointAtDistance(Math.max(0, this.travelled - 2));
    const ahead = pointAtDistance(Math.min(routeLength, this.travelled + 6));
    const height = Number.isFinite(altitude) ? Math.max(10, Math.min(30, altitude)) : 10;
    return { x: point.x, z: point.z, y: sampleTerrain(terrain, point.x, point.z) + height,
      yaw: Math.atan2(-(ahead.x - before.x), -(ahead.z - before.z)) };
  }
}
