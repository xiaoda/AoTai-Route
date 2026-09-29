export interface TerrainData {
  positions: Float32Array;
  indices: Uint32Array;
  size: number;
  segments: number;
}
export interface Rock {
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
  rotation: number;
  shape?: 'boulder';
}
export const trailX = (z: number) => 6 * Math.sin(z * 0.038) + 2 * Math.sin(z * 0.09);
export function terrainHeight(x: number, z: number): number {
  const d = x - trailX(z);
  const ridge = 13 * Math.exp(-d * d / 4200);
  const undulation = 7 * Math.sin(-z * 0.018) + 2.3 * Math.cos(x * 0.047 + z * 0.024);
  const shoulder = 10 * Math.exp(-((x + 62) ** 2 + (z + 40) ** 2) / 2000)
    + 17 * Math.exp(-((x - 70) ** 2 + (z + 74) ** 2) / 2600);
  const detail = (0.07 + Math.min(1, Math.abs(d) / 10) * 0.45)
    * Math.sin(x * 0.45 + z * 0.31) * Math.cos(z * 0.27);
  return ridge + undulation + shoulder + detail;
}
export function buildTerrain(size = 280, segments = 160, height = terrainHeight): TerrainData {
  const positions = new Float32Array((segments + 1) ** 2 * 3);
  const indices = new Uint32Array(segments * segments * 6);
  const step = size / segments;
  for (let j = 0; j <= segments; j++) for (let i = 0; i <= segments; i++) {
    const x = i * step - size / 2, z = j * step - size / 2;
    const k = (j * (segments + 1) + i) * 3;
    positions.set([x, height(x, z), z], k);
  }
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + 1, c = a + segments + 1, d = c + 1;
    indices.set([a, c, b, b, c, d], (j * segments + i) * 6);
  }
  return { positions, indices, size, segments };
}
/** 在渲染/碰撞使用的同一三角形上插值，不用不同的解析地形替代。 */
export function sampleTerrain(t: TerrainData, x: number, z: number): number {
  const gx = Math.max(0, Math.min(t.segments - 1e-6, (x + t.size / 2) / t.size * t.segments));
  const gz = Math.max(0, Math.min(t.segments - 1e-6, (z + t.size / 2) / t.size * t.segments));
  const i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
  const idx = j * (t.segments + 1) + i;
  const h = (n: number) => t.positions[n * 3 + 1];
  const a = h(idx), b = h(idx + 1), c = h(idx + t.segments + 1), d = h(idx + t.segments + 2);
  return u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - v) * (b - d) + (1 - u) * (c - d);
}
export function random(seed: number) {
  let s = seed >>> 0;
  return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; };
}
export function generateRocks(t: TerrainData): Rock[] {
  const rand = random(4301), rocks: Rock[] = [];
  for (let i = 0; i < 230; i++) {
    const x = (rand() - 0.5) * (t.size - 10), z = (rand() - 0.5) * (t.size - 10);
    if (Math.abs(x - trailX(z)) < 3.3) continue;
    const s = 0.35 + rand() ** 2 * 2.5;
    const hy = s * (0.4 + rand() * 0.45);
    rocks.push({ x, y: sampleTerrain(t, x, z) + hy * 0.67, z, hx: s, hy, hz: s * (0.6 + rand() * 0.6), rotation: rand() * Math.PI, shape: 'boulder' });
  }
  return rocks;
}
