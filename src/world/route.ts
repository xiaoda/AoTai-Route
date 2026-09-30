import {DEM,elevationAt} from './elevation';
import {ROUTE_CONTROL_POINTS,SCENIC_POINTS} from './journey';
export interface FlatPoint {x:number;z:number}
export interface RoutePoint extends FlatPoint {distance:number}
/** 水平弧长；保留原样段，扩展控制折线按至多 2 米采样。 */
export const ROUTE:readonly RoutePoint[]=(()=>{
 const result:RoutePoint[]=[{...ROUTE_CONTROL_POINTS[0],distance:0}];
 for(let i=1;i<ROUTE_CONTROL_POINTS.length;i++){
  const a=ROUTE_CONTROL_POINTS[i-1],b=ROUTE_CONTROL_POINTS[i],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/2);
  for(let j=1;j<=steps;j++){const t=j/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,prev=result.at(-1)!;result.push({x,z,distance:prev.distance+Math.hypot(x-prev.x,z-prev.z)});}
 }return result;
})();
export const routeLength=ROUTE.at(-1)!.distance;
export const clampDistance=(d:number)=>Number.isFinite(d)?Math.max(0,Math.min(routeLength,d)):0;
export function pointAtDistance(distance:number):RoutePoint{
 const d=clampDistance(distance);let low=0,high=ROUTE.length-1;
 while(high-low>1){const mid=(low+high)>>1;if(ROUTE[mid].distance<=d)low=mid;else high=mid;}
 const a=ROUTE[low],b=ROUTE[high],t=(d-a.distance)/(b.distance-a.distance);
 return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,distance:d};
}
const segmentProjection=(point:FlatPoint,i:number)=>{
 const a=ROUTE[i-1],b=ROUTE[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz)));
 return {offset:Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz),distance:a.distance+t*(b.distance-a.distance)};
};
export function projectToRoute(point:FlatPoint):{distance:number;offset:number}{
 let best={distance:0,offset:Infinity};
 if(!Number.isFinite(point.x)||!Number.isFinite(point.z))return best;
 for(let i=1;i<ROUTE.length;i++){const p=segmentProjection(point,i);if(p.offset<best.offset)best=p;}return best;
}
// 生成几十万个装饰候选时只查同一格；每段扩展 16 米，路径净空所需范围内精确。
const cellSize=32,bins=new Map<string,number[]>();
for(let i=1;i<ROUTE.length;i++){
 const a=ROUTE[i-1],b=ROUTE[i];
 for(let z=Math.floor((Math.min(a.z,b.z)-16)/cellSize);z<=Math.floor((Math.max(a.z,b.z)+16)/cellSize);z++)for(let x=Math.floor((Math.min(a.x,b.x)-16)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+16)/cellSize);x++){
  const key=x+','+z,items=bins.get(key)??[];items.push(i);bins.set(key,items);
 }
}
/** 16 米内与精确投影一致；远处可能返回 Infinity。仅用于净空/细路径材质。 */
export function pathClearance(x:number,z:number):number{
 let distance=Infinity;for(const i of bins.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))??[])distance=Math.min(distance,segmentProjection({x,z},i).offset);return distance;
}
export const VIEWPOINTS=SCENIC_POINTS.map(p=>({...p,distance:projectToRoute(p).distance}));
export const VIEWPOINT=VIEWPOINTS[1];
export const VIEWPOINT_LOOK={yaw:VIEWPOINT.yaw,footPitch:VIEWPOINT.footPitch,airPitch:VIEWPOINT.airPitch};
export function chapterAtDistance(distance:number){
 return distance<(VIEWPOINTS[0].distance+VIEWPOINTS[1].distance)/2?VIEWPOINTS[0]:distance<(VIEWPOINTS[1].distance+VIEWPOINTS[2].distance)/2?VIEWPOINTS[1]:VIEWPOINTS[2];
}
export const routeMetrics=(()=>{
 let groundLength=0,ascent=0,descent=0,maxSlope=0,minElevation=Infinity,maxElevation=-Infinity;
 for(let i=0;i<ROUTE.length;i++){const p=ROUTE[i],h=elevationAt(p.x,p.z);minElevation=Math.min(minElevation,h);maxElevation=Math.max(maxElevation,h);if(!i)continue;
  const a=ROUTE[i-1],dh=h-elevationAt(a.x,a.z),d=p.distance-a.distance;groundLength+=Math.hypot(d,dh);ascent+=Math.max(dh,0);descent+=Math.max(-dh,0);maxSlope=Math.max(maxSlope,Math.atan2(Math.abs(dh),d)*180/Math.PI);
 }return {horizontalLength:routeLength,groundLength,ascent,descent,maxSlope,minElevation,maxElevation};
})();
/** 240×240 SVG，地图边界与可行走网格一致，-Z 为北。 */
export function worldToMap(point:FlatPoint){return {x:16+(point.x+DEM.near.size/2)/DEM.near.size*208,y:16+(point.z+DEM.near.size/2)/DEM.near.size*208};}
