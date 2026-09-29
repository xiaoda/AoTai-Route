import { expect, test } from 'vitest';
import { DEM, ELEVATION_OFFSET, elevationAt, sampleElevationGrid, validateGrid, worldToGeo } from './elevation';
import { buildTerrain, sampleTerrain, buildDistantTerrain, TERRAIN_SIZE, ROUTE_START_Z, ROUTE_END_Z, trailX } from './terrain';

test('真实数据来源、精度、空值和对照点可追溯', () => {
 expect(DEM.source.tiles).toHaveLength(4); expect(DEM.validation.voidCount).toBe(0);
 for (const tile of DEM.source.tiles) { expect(tile.sources.startsWith('srtm/')).toBe(true); expect(tile.sha256).toMatch(/^[a-f0-9]{64}$/); }
 expect(DEM.source.groundPixelMetres).toBeGreaterThan(30); expect(DEM.source.groundPixelMetres).toBeLessThan(33);
 for (const p of DEM.validation.controlSamples) expect(Math.abs(elevationAt(p.x,p.z)-p.elevation)).toBeLessThan(.051);
});
test('网格结构与非法输入失败可见，绝不回退随机山', () => {
 expect(()=>validateGrid({size:10,segments:2,heights:[0]})).toThrow();
 expect(()=>sampleElevationGrid(DEM.near,NaN,0)).toThrow(); expect(()=>elevationAt(5000,0)).toThrow();
 expect(worldToGeo(100,-100).lon).toBeGreaterThan(DEM.origin.lon); expect(worldToGeo(100,-100).lat).toBeGreaterThan(DEM.origin.lat);
});
test('真实地面与碰撞网格一致，Y 无垂直夸大', () => {
 const t=buildTerrain(); for(let z=-496;z<=496;z+=31)for(let x=-496;x<=496;x+=31) expect(Math.abs(sampleTerrain(t,x,z)+ELEVATION_OFFSET-elevationAt(x,z))).toBeLessThan(.001);
});
test('近远地形在细分边界完全衔接，远山不覆盖可行走区域', () => {
 const t=buildTerrain(), far=buildDistantTerrain(t), half=TERRAIN_SIZE/2; let shared=0;
 for(let i=0;i<far.positions.length;i+=3){const x=far.positions[i],y=far.positions[i+1],z=far.positions[i+2];
  if ((Math.abs(x)===half&&Math.abs(z)<=half)||(Math.abs(z)===half&&Math.abs(x)<=half)){expect(Math.abs(y-sampleTerrain(t,x,z))).toBeLessThan(.001);shared++;}}
 expect(shared).toBeGreaterThanOrEqual(4*t.segments);
 for(let i=0;i<far.indices.length;i+=3){const ids=[far.indices[i],far.indices[i+1],far.indices[i+2]],x=ids.reduce((s,n)=>s+far.positions[n*3],0)/3,z=ids.reduce((s,n)=>s+far.positions[n*3+2],0)/3;expect(Math.max(Math.abs(x),Math.abs(z))).toBeGreaterThanOrEqual(half-1e-6);}
});
test('虚拟游览路径坡度在角色能力内，保留真实高程', () => {
 const t=buildTerrain();let maxSlope=0;
 for(let z=ROUTE_START_Z;z>ROUTE_END_Z;z-=1){const x=trailX(z),nextX=trailX(z-1);const dh=sampleTerrain(t,nextX,z-1)-sampleTerrain(t,x,z);maxSlope=Math.max(maxSlope,Math.atan2(Math.abs(dh),Math.hypot(nextX-x,1))*180/Math.PI);}
 expect(maxSlope).toBeLessThan(39);
});
