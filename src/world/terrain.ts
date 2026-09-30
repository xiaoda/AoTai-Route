import { habitatAt, stoneRiverCenter } from './habitat';
import {legacyTrailX as trailX} from './journey';
import {pathClearance,pointAtDistance,routeLength} from './route';
import { DEM, elevationAt, ELEVATION_OFFSET, sampleElevationGrid } from './elevation';
export interface MeshData { positions: Float32Array; indices: Uint32Array }
export interface TerrainData extends MeshData {
  size: number;
  segments: number;
}
export interface Rock {
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
  rotation: number;
  shape?: 'boulder';
  variant?: number;
  orientation?: { x: number; y: number; z: number; w: number };
}
export const TERRAIN_SIZE = DEM.near.size;
// 仅为保留已验收中段生成序列的兼容导出；新路线唯一配置在 journey/route。
export {LEGACY_START_Z as ROUTE_START_Z,LEGACY_END_Z as ROUTE_END_Z,legacyTrailX as trailX} from './journey';
export const terrainHeight = (x: number, z: number) => elevationAt(x, z) - ELEVATION_OFFSET;
export function buildTerrain(size = TERRAIN_SIZE, segments = DEM.near.segments, height = terrainHeight): TerrainData {
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
/** 把岩块底面贴合局部坡面；q = slope * yaw，渲染/凸包共享此四元数。 */
export function surfaceOrientation(t: TerrainData, x: number, z: number, yaw = 0) {
 const nx = -(sampleTerrain(t,x+.5,z)-sampleTerrain(t,x-.5,z)), nz = -(sampleTerrain(t,x,z+.5)-sampleTerrain(t,x,z-.5));
 const length=Math.hypot(nx,1,nz), ax=nz/length,az=-nx/length,w=1+1/length,qLength=Math.hypot(ax,az,w);
 const qx=ax/qLength,qz=az/qLength,qw=w/qLength,c=Math.cos(yaw/2),s=Math.sin(yaw/2);
 return {x:qx*c-qz*s,y:qw*s,z:qx*s+qz*c,w:qw*c};
}
export function generateLegacyRocks(t: TerrainData): Rock[] {
 const rand=random(4301),rocks:Rock[]=[];
 const small=t.size<500;
 for(let i=0;i<(small?1100:6500);i++){
  const z=(rand()-.5)*Math.min(t.size-12,800);
  const center=stoneRiverCenter(z);
  const x=small?(rand()-.5)*(t.size-12):i<4700?center+(rand()-.5)*78:trailX(z)+(rand()-.5)*260;
  if(Math.abs(x)>Math.min(t.size,1024)/2-5)continue;
  const h=sampleTerrain(t,x,z),dx=(sampleTerrain(t,x+1,z)-sampleTerrain(t,x-1,z))*.5,dz=(sampleTerrain(t,x,z+1)-sampleTerrain(t,x,z-1))*.5;
  const cover=habitatAt(x,z,h+ELEVATION_OFFSET,1-1/Math.hypot(dx,1,dz));
  if(!small&&rand()>cover.stone*.86+.025)continue;
  const s=.45+rand()**1.8*1.65,hz=s*(.7+rand()*.65),hy=s*(.36+rand()*.45);
  if(Math.abs(x-trailX(z))<2.3+Math.max(s,hz)*1.5)continue;
  const rotation=rand()*Math.PI;
  rocks.push({x,y:h+hy*.16,z,hx:s,hy,hz,rotation,orientation:surfaceOrientation(t,x,z,rotation),variant:Math.floor(rand()*3),shape:'boulder'});
 }
 return rocks;
}

/** 中段原生成序列保留，两端使用独立种子增补；先生成再排除统一路线，避免串扰随机序列。 */
export function generateRocks(t:TerrainData):Rock[]{
 const base=generateLegacyRocks(t);if(t.size<500)return base;
 const rocks=base.filter(r=>pathClearance(r.x,r.z)>2.3+Math.max(r.hx,r.hz)*1.5),rand=random(920301);
 for(let i=0;i<18000;i++){
  const d=rand()*routeLength,p=pointAtDistance(d),a=pointAtDistance(d-1),b=pointAtDistance(d+1),len=Math.hypot(b.x-a.x,b.z-a.z),offset=(rand()-.5)*330;
  const x=p.x-(b.z-a.z)/len*offset,z=p.z+(b.x-a.x)/len*offset;
  if(Math.max(Math.abs(x),Math.abs(z))>t.size/2-6||(z>-400&&z<400&&Math.abs(x-trailX(z))<160))continue;
  const h=sampleTerrain(t,x,z),dx=(sampleTerrain(t,x+1,z)-sampleTerrain(t,x-1,z))*.5,dz=(sampleTerrain(t,x,z+1)-sampleTerrain(t,x,z-1))*.5,cover=habitatAt(x,z,h+ELEVATION_OFFSET,1-1/Math.hypot(dx,1,dz));
  if(rand()>cover.stone*.80+.035)continue;
  const s=(.45+rand()**1.8*1.65)*(z<-500?1.12:.85),hz=s*(.7+rand()*.65),hy=s*(.36+rand()*.45);
  if(pathClearance(x,z)<2.5+Math.max(s,hz)*1.6)continue;
  const rotation=rand()*Math.PI;rocks.push({x,y:h+hy*.16,z,hx:s,hy,hz,rotation,orientation:surfaceOrientation(t,x,z,rotation),variant:Math.floor(rand()*3),shape:'boulder'});
 }return rocks;
}

/** 远景粗网格仅占近景外部。内边缘细分到近景步长，用三角扇缝合而非裙边遮洞。 */
export function buildDistantTerrain(near: TerrainData): MeshData {
 const grid = DEM.far, step = grid.size / grid.segments, half = near.size / 2, fine = near.size / near.segments;
 const positions: number[] = [], indices: number[] = [], cache = new Map<string,number>();
 const vertex = (x: number,z: number) => {
  const key = x + ',' + z, found = cache.get(key); if(found !== undefined) return found;
  const edge = Math.max(Math.abs(x),Math.abs(z)) === half;
  const h = edge ? sampleTerrain(near,x,z) : sampleElevationGrid(grid,x,z) - ELEVATION_OFFSET;
  const id = positions.length / 3; positions.push(x,h,z); cache.set(key,id); return id;
 };
 for(let j=0;j<grid.segments;j++) for(let i=0;i<grid.segments;i++) {
  const x=i*step-grid.size/2,z=j*step-grid.size/2;
  if(x>=-half&&x+step<=half&&z>=-half&&z+step<=half)continue;
  const corners=[[x,z],[x,z+step],[x+step,z+step],[x+step,z]], polygon:number[]=[];
  let stitched=false;
  for(let k=0;k<4;k++){
   const a=corners[k],b=corners[(k+1)%4];
   const onEdge=(a[0]===b[0]&&Math.abs(a[0])===half&&Math.abs(a[1])<=half&&Math.abs(b[1])<=half)||(a[1]===b[1]&&Math.abs(a[1])===half&&Math.abs(a[0])<=half&&Math.abs(b[0])<=half);
   const count=onEdge?Math.round(step/fine):1; if(onEdge)stitched=true;
   for(let n=0;n<count;n++)polygon.push(vertex(a[0]+(b[0]-a[0])*n/count,a[1]+(b[1]-a[1])*n/count));
  }
  if(stitched){const center=vertex(x+step/2,z+step/2);for(let n=0;n<polygon.length;n++)indices.push(center,polygon[n],polygon[(n+1)%polygon.length]);}
  else indices.push(polygon[0],polygon[1],polygon[3],polygon[3],polygon[1],polygon[2]);
 }
 return {positions:new Float32Array(positions),indices:new Uint32Array(indices)};
}
