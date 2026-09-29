import { expect, test } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

test('缺失或损坏的设置回退为默认值', () => {
  for (const value of [null, '{broken', 'null', '[]', '42']) {
    expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS);
  }
});
test('设置只接收有效类型并限制取值范围', () => {
  expect(parseSettings(JSON.stringify({ sensitivity: 99, fov: 1, bob: false, quality: 'bad' })))
    .toEqual({ sensitivity: 2, fov: 55, bob: false, quality: 'balanced' });
  expect(parseSettings('{"sensitivity":"fast","bob":"false"}')).toEqual(DEFAULT_SETTINGS);
});
