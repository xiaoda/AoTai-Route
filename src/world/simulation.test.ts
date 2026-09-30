import { afterEach, beforeAll, expect, test } from 'vitest';
import { ROUTE } from './route';
import { initPhysics, Walker, type WorldData } from './simulation';
import { buildTerrain, sampleTerrain, trailX, generateRocks, ROUTE_START_Z, ROUTE_END_Z } from './terrain';

beforeAll(async () => { await initPhysics(); });
const walkers: Walker[] = [];
afterEach(() => { walkers.splice(0).forEach(w => w.dispose()); });
function make(data?: Partial<WorldData>) {
  const t = buildTerrain(100, 40, () => 0);
  const w = new Walker({ terrain: t, obstacles: [], spawn: { x: 0, y: 0, z: 10 }, ...data });
  walkers.push(w);
  for (let i = 0; i < 60; i++) w.advance(1 / 60, { x: 0, z: 0 });
  return w;
}

test('静止时胶囊接地，眼睛距离地面约 1.68 米', () => {
  const w = make();
  expect(w.position.y).toBeGreaterThan(0.84);
  expect(w.position.y).toBeLessThan(0.91);
  expect(w.eyePosition.y).toBeCloseTo(1.70, 1);
});
test('30/60/144 FPS 下相同行进时间得到相同位移', () => {
  const results = [30, 60, 144].map(fps => {
    const w = make();
    for (let i = 0; i < fps * 5; i++) w.advance(1 / fps, { x: 0, z: -1 });
    return w.position.z;
  });
  expect(Math.max(...results) - Math.min(...results)).toBeLessThan(0.04);
  expect(results[0]).toBeLessThan(4);
});
test('撞到高障碍会停下，不穿过岩石', () => {
  const w = make({ obstacles: [{ x: 0, y: 1, z: 5, hx: 2, hy: 1, hz: 0.5, rotation: 0 }] });
  for (let i = 0; i < 600; i++) w.advance(1 / 60, { x: 0, z: -1 });
  expect(w.position.z).toBeGreaterThan(5.7);
  expect(w.position.z).toBeLessThan(6.2);
});
test('测试岩块凸包与渲染同源，能阻挡角色', () => {
  const w = make({ obstacles: [{ x: 0, y: 1, z: 5, hx: 2, hy: 1, hz: 1, rotation: 0, shape: 'boulder' }] });
  for (let i = 0; i < 400; i++) w.advance(1 / 60, { x: 0, z: -1 });
  expect(w.position.z).toBeGreaterThan(5);
  expect(w.position.z).toBeLessThan(6.5);
});
test('可以跨越低台阶并重新贴地', () => {
  const w = make({ obstacles: [{ x: 0, y: 0.1, z: 5, hx: 2, hy: 0.1, hz: 1, rotation: 0 }] });
  for (let i = 0; i < 480; i++) w.advance(1 / 60, { x: 0, z: -1 });
  expect(w.position.z).toBeLessThan(3);
  expect(w.position.y).toBeLessThan(0.92);
});
test('斜向输入不会产生额外速度', () => {
  const a = make(), b = make();
  for (let i = 0; i < 120; i++) { a.advance(1 / 60, { x: 1, z: 0 }); b.advance(1 / 60, { x: 1, z: -1 }); }
  // 不同三角网格接触路径有微小损耗，但斜走不能得到 sqrt(2) 倍速度。
  const diagonal = Math.hypot(b.position.x, b.position.z - 10);
  expect(diagonal).toBeLessThanOrEqual(a.position.x + 0.02);
  expect(diagonal).toBeGreaterThan(a.position.x * 0.95);
});
test('沿连续坡面下坡仍保持贴地', () => {
  const t = buildTerrain(100, 60, (_x, z) => z * 0.2);
  const w = make({ terrain: t, spawn: { x: 0, y: 2, z: 10 } });
  for (let i = 0; i < 300; i++) w.advance(1 / 60, { x: 0, z: -1 });
  expect(w.position.y - sampleTerrain(t, w.position.x, w.position.z)).toBeGreaterThan(0.8);
  expect(w.position.y - sampleTerrain(t, w.position.x, w.position.z)).toBeLessThan(1.02);
});
test('接近场景边缘时停止，不走出地形', () => {
  const w = make({ spawn: { x: 46, y: 0, z: 10 } });
  for (let i = 0; i < 180; i++) w.advance(1 / 60, { x: 1, z: 0 });
  expect(w.position.x).toBeLessThanOrEqual(47);
  expect(w.boundaryReached).toBe(true);
});
test('无效输入不会污染位置，静止时不明显漂移', () => {
  const w = make(), start = w.position;
  w.advance(NaN, { x: 1, z: 1 });
  for (let i = 0; i < 300; i++) w.advance(1 / 60, { x: NaN, z: Infinity });
  expect(Number.isFinite(w.position.y)).toBe(true);
  expect(Math.hypot(w.position.x - start.x, w.position.z - start.z)).toBeLessThan(0.03);
});
test('长帧被限制，暂停时不补算积累时间，复位可用', () => {
  const w = make();
  w.advance(20, { x: 0, z: -1 });
  expect(10 - w.position.z).toBeLessThan(0.3);
  const p = { ...w.position };
  w.pause();
  expect(w.position).toEqual(p);
  w.reset();
  expect(w.position.z).toBe(10);
});
test('沿真实地形上坡保持在地面之上', () => {
  const t = buildTerrain();
  const z = 35, x = trailX(z);
  const w = make({ terrain: t, spawn: { x, z, y: sampleTerrain(t, x, z) } });
  for (let i = 0; i < 300; i++) w.advance(1 / 60, { x: 0, z: -1 });
  const ground = sampleTerrain(t, w.position.x, w.position.z);
  expect(w.position.y - ground).toBeGreaterThan(0.8);
  expect(w.position.y - ground).toBeLessThan(1.05);
});

test('真实样段完整步行，无穿地和障碍阻断', () => {
 const t=buildTerrain(),z=ROUTE_START_Z,x=trailX(z),w=make({terrain:t,obstacles:generateRocks(t),spawn:{x,z,y:sampleTerrain(t,x,z)}});
 let samples=0;
 for(let i=0;i<22000 && w.position.z>ROUTE_END_Z;i++){
  const p=w.position,targetZ=Math.max(ROUTE_END_Z,p.z-2),dx=trailX(targetZ)-p.x,dz=targetZ-p.z,len=Math.hypot(dx,dz);
  w.advance(1/60,{x:dx/len,z:dz/len});
  if(i%120===0){const q=w.position,clearance=q.y-sampleTerrain(t,q.x,q.z);expect(clearance).toBeGreaterThan(.8);expect(clearance).toBeLessThan(1.3);samples++;}
 }
 expect(samples).toBeGreaterThan(100);expect(w.position.z).toBeLessThanOrEqual(ROUTE_END_Z+.1);
},60000);

test('用户主动选择观景位置使用真实地面，复位仍返回原起点',()=>{
 const w=make();w.moveToViewpoint(12,-8);
 for(let i=0;i<30;i++)w.advance(1/60,{x:0,z:0});
 expect(w.position.x).toBeCloseTo(12,2);expect(w.position.z).toBeCloseTo(-8,2);expect(w.grounded).toBe(true);expect(w.eyePosition.y).toBeCloseTo(1.7,1);
 expect(()=>w.moveToViewpoint(NaN,0)).toThrow();expect(()=>w.moveToViewpoint(10000,0)).toThrow();
 w.reset();expect(w.position.x).toBe(0);expect(w.position.z).toBe(10);
});


test('第二批全长路线实际物理步行，穿过三个节点且不中断、不穿地',()=>{
 const t=buildTerrain(),first=ROUTE[0],last=ROUTE[ROUTE.length-1],w=make({terrain:t,obstacles:generateRocks(t),spawn:{x:first.x,z:first.z,y:sampleTerrain(t,first.x,first.z)}});
 let index=1,samples=0;
 for(let i=0;i<150000;i++){
  const p=w.position;let target=ROUTE[index],dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz);
  if(index===ROUTE.length-1&&len<.15)break;
  if(len<.5&&index<ROUTE.length-1){index++;target=ROUTE[index];dx=target.x-p.x;dz=target.z-p.z;len=Math.hypot(dx,dz);}
  w.advance(1/60,{x:dx/len,z:dz/len});
  if(i%120===0){const q=w.position,clearance=q.y-sampleTerrain(t,q.x,q.z);expect(clearance).toBeGreaterThan(.8);expect(clearance).toBeLessThan(1.3);samples++;}
 }
 expect(samples).toBeGreaterThan(500);expect(index).toBe(ROUTE.length-1);expect(Math.hypot(w.position.x-last.x,w.position.z-last.z)).toBeLessThan(.2);
},180000);
