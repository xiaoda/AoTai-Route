import { expect, test } from 'vitest';
import { ROUTE, routeLength, pointAtDistance, projectToRoute, worldToMap } from './route';
import { trailX, TERRAIN_SIZE } from './terrain';
import {ROUTE_CONTROL_POINTS} from './journey';

test('路径与场景步道同源，起终点及累计距离正确', () => {
  expect(ROUTE[0]).toMatchObject({...ROUTE_CONTROL_POINTS[0],distance:0});
  expect(ROUTE.at(-1)).toMatchObject(ROUTE_CONTROL_POINTS.at(-1)!);
  expect(routeLength).toBeGreaterThan(2000);
  for(let z=60;z>=-320;z--)expect(projectToRoute({x:trailX(z),z}).offset).toBeLessThan(1e-8);
  for (let i = 1; i < ROUTE.length; i++) {
    expect(ROUTE[i].distance).toBeGreaterThan(ROUTE[i - 1].distance);
    expect(ROUTE[i].distance-ROUTE[i-1].distance).toBeLessThanOrEqual(2.001);
    expect(Math.abs(ROUTE[i].z)).toBeLessThan(TERRAIN_SIZE / 2 - 3);
  }
});
test('距离采样连续，越界和非法输入返回安全端点', () => {
  expect(pointAtDistance(-10)).toEqual(pointAtDistance(0));
  expect(pointAtDistance(Infinity)).toEqual(pointAtDistance(0));
  expect(pointAtDistance(routeLength + 10)).toEqual(pointAtDistance(routeLength));
  for (let d = 0; d < routeLength - 0.1; d += 1) {
    const a = pointAtDistance(d), b = pointAtDistance(d + 0.1);
    expect(b.distance-a.distance).toBeCloseTo(.1,8);
    expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThan(.09);
    expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeLessThanOrEqual(.100001);
  }
});
test('最近点投影可逆，离开路线仍保留偏移距离', () => {
  for (const d of [0, 17.5, 53.2, routeLength]) {
    const p = pointAtDistance(d);
    expect(projectToRoute(p).distance).toBeCloseTo(d, 8);
    expect(projectToRoute(p).offset).toBeCloseTo(0, 8);
  }
  expect(projectToRoute({ x: 80, z: 10 }).offset).toBeGreaterThan(65);
});
test('地图北向上，中心与边界映射一致', () => {
  expect(worldToMap({ x: 0, z: 0 })).toEqual({ x: 120, y: 120 });
  expect(worldToMap({ x: -TERRAIN_SIZE / 2, z: -TERRAIN_SIZE / 2 })).toEqual({ x: 16, y: 16 });
  expect(worldToMap({ x: TERRAIN_SIZE / 2, z: TERRAIN_SIZE / 2 })).toEqual({ x: 224, y: 224 });
  expect(worldToMap({ x: 0, z: -50 }).y).toBeLessThan(120);
});
