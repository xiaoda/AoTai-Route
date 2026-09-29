import { expect, test } from 'vitest';
import { movement, turn } from './input';
test('斜向输入归一化，视角只影响水平方向', () => {
  const m = movement(new Set(['KeyW', 'KeyD']), 0.8);
  expect(Math.hypot(m.x, m.z)).toBeCloseTo(1, 10);
  expect(movement(new Set(['KeyW', 'KeyS']), 0).z).toBeCloseTo(0);
});
test('俯仰受限，鼠标左右与视角一致', () => {
  const input = { keys: new Set<string>(), yaw: 0, pitch: 0 };
  turn(input, 100, 100000, 1);
  expect(input.pitch).toBe(-1.25);
  expect(input.yaw).toBeLessThan(0);
});
