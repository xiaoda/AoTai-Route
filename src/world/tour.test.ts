import { expect, test } from 'vitest';
import { AirTour } from './tour';
import { routeLength } from './route';
import { buildTerrain, sampleTerrain } from './terrain';

test('3/6/12 米每秒按弧长推进，30/60/144 FPS 结果一致', () => {
  for (const speed of [3, 6, 12]) for (const fps of [30, 60, 144]) {
    const tour = new AirTour();
    for (let i = 0; i < fps * 4; i++) tour.advance(1 / fps, speed);
    expect(tour.distance).toBeCloseTo(speed * 4, 8);
  }
});
test('非法时间、速度不推进，卡顿不跳过大段路程', () => {
  const tour = new AirTour();
  for (const delta of [NaN, Infinity, -1, 0]) tour.advance(delta, 6);
  for (const speed of [NaN, Infinity, -1, 0]) tour.advance(0.1, speed);
  expect(tour.distance).toBe(0);
  tour.advance(100, 6);
  expect(tour.distance).toBeCloseTo(0.6);
  tour.advance(0.1, 1000);
  expect(tour.distance).toBeCloseTo(1.8);
});
test('换速连续，终点停止，重置/定位安全', () => {
  const tour = new AirTour();
  tour.advance(0.1, 3); tour.advance(0.1, 12);
  expect(tour.distance).toBeCloseTo(1.5);
  tour.seek(routeLength - 0.1); tour.advance(0.1, 12);
  expect(tour.complete).toBe(true);
  expect(tour.distance).toBe(routeLength);
  tour.advance(0.1, 6); expect(tour.distance).toBe(routeLength);
  tour.reset(); expect(tour.distance).toBe(0); expect(tour.complete).toBe(false);
  tour.seek(NaN); expect(tour.distance).toBe(0);
});
test('全路段视点相对实际三角网格保持指定高度且朝向有限', () => {
  const terrain = buildTerrain();
  const tour = new AirTour();
  for (const height of [10, 30]) for (let d = 0; d <= routeLength; d += 0.5) {
    tour.seek(d);
    const pose = tour.pose(terrain, height);
    expect(pose.y - sampleTerrain(terrain, pose.x, pose.z)).toBeCloseTo(height, 8);
    expect(Number.isFinite(pose.yaw)).toBe(true);
    expect(Math.abs(pose.yaw)).toBeLessThan(0.6);
  }
  tour.seek(routeLength);
  expect(Number.isFinite(tour.pose(terrain, 10).yaw)).toBe(true);
});
