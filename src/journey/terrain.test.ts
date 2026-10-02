import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { LANDMARKS } from './landmarks';
import { regionPoint,sampleRegion,validateTerrain } from './terrain';
const raw=JSON.parse(readFileSync(new URL('../../public/journey/terrain.json',import.meta.url),'utf8'));
describe('区域地形资产',()=>{
 it('网格、边界、高程和原始证据完整',()=>{const d=validateTerrain(raw);expect(d.heights.length).toBe(125541);expect(raw.source.tiles).toHaveLength(24);for(const t of raw.source.tiles){expect(t.sha256).toMatch(/^[0-9a-f]{64}$/);expect(t.sources).toContain('srtm/');}});
 it('拒绝空值、错位网格与不一致坐标范围',()=>{expect(()=>validateTerrain({})).toThrow();expect(()=>validateTerrain({...raw,heights:[1]})).toThrow();expect(()=>validateTerrain({...raw,bounds:{...raw.bounds,north:35}})).toThrow();});
 it('所有主地标落在高山区域，但不把 DEM 当海拔测量值',()=>{for(const p of LANDMARKS){const h=sampleRegion(raw,p.coordinate);expect(h).toBeGreaterThan(3100);expect(h).toBeLessThan(4000);}});
 it('地形晕渲图与固定哈希一致',()=>{const png=readFileSync(new URL('../../public/journey/relief.png',import.meta.url));expect(createHash('sha256').update(png).digest('hex')).toBe(raw.relief.sha256);});
 it('三维坐标保留真实垂直尺度与朝向',()=>{const a=regionPoint({lon:107.5,lat:33.94},3000),b=regionPoint({lon:107.51,lat:33.95},4000);expect(b.y-a.y).toBe(1);expect(b.x).toBeGreaterThan(a.x);expect(b.z).toBeLessThan(a.z);});
});
