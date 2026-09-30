import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {DEM,elevationAt} from './elevation';
import {ROUTE,routeLength,VIEWPOINT,VIEWPOINTS,routeMetrics,pointAtDistance,projectToRoute,pathClearance} from './route';

test('连续路线达到 2—3 公里，三个节点有分离的真实米制位置',()=>{
 expect(routeLength).toBeGreaterThanOrEqual(2000);expect(routeLength).toBeLessThanOrEqual(3000);
 expect(VIEWPOINTS).toHaveLength(3);
 for(let i=0;i<VIEWPOINTS.length;i++){
  const p=VIEWPOINTS[i];expect(projectToRoute(p).offset).toBeLessThan(.001);
  if(i)expect(p.distance-VIEWPOINTS[i-1].distance).toBeGreaterThan(400);
 }
 expect(VIEWPOINT.x).toBeCloseTo(-309.80412679671883,8);expect(VIEWPOINT.z).toBe(-64);
 expect(routeMetrics.groundLength).toBeGreaterThan(routeLength);expect(routeMetrics.ascent).toBeGreaterThan(100);expect(routeMetrics.descent).toBeGreaterThan(100);
 expect(routeMetrics.maxSlope).toBeLessThan(39);
 for(const p of ROUTE)expect(Math.max(Math.abs(p.x),Math.abs(p.z))).toBeLessThan(DEM.near.size/2-20);
});
test('扩展高程使用同源 8 米网格，已验收核心 1024 米全部顶点不变',()=>{
 expect(DEM.near.size).toBe(2048);expect(DEM.near.segments).toBe(256);
 const core:number[]=[];for(let z=-512;z<=512;z+=8)for(let x=-512;x<=512;x+=8)core.push(Math.round(elevationAt(x,z)*10));
 expect(createHash('sha256').update(core.join(',')).digest('hex')).toBe('b552736659752d7c85c139ea34eec4155b864c38215f51f3dd5783bf984f55d4');
});
test('路线净空空间索引与精确投影一致，不制造地表/碰撞偏移',()=>{
 for(let d=0;d<routeLength;d+=19){const p=pointAtDistance(d);for(const dx of [-5,0,5]){const x=p.x+dx;expect(pathClearance(x,p.z)).toBeCloseTo(projectToRoute({x,z:p.z}).offset,5);}}
 expect(pathClearance(1000,1000)).toBeGreaterThan(10);
});
