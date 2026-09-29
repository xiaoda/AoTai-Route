import { expect, test } from 'vitest';
import { buildTerrain, sampleTerrain, terrainHeight, trailX, generateRocks } from './terrain';

test('地形输出确定、有限，所有三角形索引有效', () => {
  const a = buildTerrain(40, 20), b = buildTerrain(40, 20);
  expect(a.positions).toEqual(b.positions);
  expect(a.positions.length).toBe(21 * 21 * 3);
  expect(a.indices.length).toBe(20 * 20 * 6);
  expect([...a.positions].every(Number.isFinite)).toBe(true);
  expect(Math.max(...a.indices)).toBeLessThan(21 * 21);
});
test('网格顶点采样与高程函数一致，网格朝上', () => {
  const t = buildTerrain(40, 20);
  expect(sampleTerrain(t, 0, 0)).toBeCloseTo(terrainHeight(0, 0), 4);
  const [a, b, c] = t.indices;
  const ux = t.positions[b * 3] - t.positions[a * 3];
  const uz = t.positions[b * 3 + 2] - t.positions[a * 3 + 2];
  const vx = t.positions[c * 3] - t.positions[a * 3];
  const vz = t.positions[c * 3 + 2] - t.positions[a * 3 + 2];
  expect(uz * vx - ux * vz).toBeGreaterThan(0);
});
test('边界采样有限，步道与岩石布置可复现', () => {
  const t = buildTerrain(40, 20);
  expect(Number.isFinite(sampleTerrain(t, 10000, -10000))).toBe(true);
  expect(Number.isFinite(trailX(-80))).toBe(true);
  expect(generateRocks(t)).toEqual(generateRocks(t));
});

test('坡面岩石四元数归一，底部深入同源地面，不是浮在水平基座上', () => {
 const t=buildTerrain(),rocks=generateRocks(t);
 for(const r of rocks){const q=r.orientation!;expect(Math.hypot(q.x,q.y,q.z,q.w)).toBeCloseTo(1,10);
 // 四元数旋转底部中心 (0,-0.6hy,0)。石体底面沿局部法线，与渲染/碰撞相同。
 const y=-.6*r.hy,px=-2*(q.x*q.y-q.z*q.w)*(-y),py=(1-2*(q.x*q.x+q.z*q.z))*y,pz=2*(q.y*q.z+q.x*q.w)*y;
 expect(r.y+py-sampleTerrain(t,r.x+px,r.z+pz)).toBeLessThan(.06);}
});
