import data from '../data/taibai-dem.json';

export interface ElevationGrid { size: number; segments: number; heights: readonly number[] }
export function validateGrid(grid: ElevationGrid): void {
 if (!Number.isFinite(grid.size) || grid.size <= 0 || grid.size > 20000 || !Number.isInteger(grid.segments) || grid.segments < 2 || grid.segments > 512 || grid.heights.length !== (grid.segments + 1) ** 2 || grid.heights.some(h => !Number.isInteger(h) || h < -120000 || h > 90000)) throw new Error('高程网格无效，拒绝加载替代地形。');
}
if (data.schemaVersion !== 1 || data.near.encoding !== 'decimetres' || data.far.encoding !== 'decimetres') throw new Error('不支持的高程数据版本');
validateGrid(data.near); validateGrid(data.far);
export const DEM = data;
export const ELEVATION_OFFSET = data.origin.elevationOffset;
/** 地形三角形与 Rapier 网格使用同一对角线；返回 EGM96 数据高程（米）。 */
export function sampleElevationGrid(grid: ElevationGrid, x: number, z: number): number {
 if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > grid.size / 2 + 1e-7 || Math.abs(z) > grid.size / 2 + 1e-7) throw new Error('请求位置超出高程覆盖范围');
 const gx = Math.max(0, Math.min(grid.segments, (x + grid.size / 2) / grid.size * grid.segments));
 const gz = Math.max(0, Math.min(grid.segments, (z + grid.size / 2) / grid.size * grid.segments));
 const i = Math.min(grid.segments - 1, Math.floor(gx)), j = Math.min(grid.segments - 1, Math.floor(gz)), u = gx - i, v = gz - j;
 const k = j * (grid.segments + 1) + i, a = grid.heights[k], b = grid.heights[k + 1], c = grid.heights[k + grid.segments + 1], d = grid.heights[k + grid.segments + 2];
 return (u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - v) * (b - d) + (1 - u) * (c - d)) / 10;
}
export function elevationAt(x: number, z: number): number {
 return sampleElevationGrid(Math.max(Math.abs(x), Math.abs(z)) <= data.near.size / 2 ? data.near : data.far, x, z);
}
export function worldToGeo(x: number, z: number) {
 return { lon: data.origin.lon + x / data.origin.metersPerLongitude, lat: data.origin.lat - z / data.origin.metersPerLatitude };
}
