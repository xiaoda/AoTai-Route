import {type TerrainData,type Rock,sampleTerrain,random,trailX,generateLegacyRocks} from './terrain';
import {habitatAt,fieldNoise} from './habitat';
import {ELEVATION_OFFSET} from './elevation';
import {pathClearance,pointAtDistance,routeLength} from './route';
export interface Plant{x:number;y:number;z:number;scale:number;rotation:number;tone:number;shrub:boolean}
function rockMask(rocks:Rock[]){
 const bins=new Map<string,Rock[]>(),cell=8;
 for(const r of rocks){const k=Math.floor(r.x/cell)+','+Math.floor(r.z/cell),a=bins.get(k)??[];a.push(r);bins.set(k,a);}
 return (x:number,z:number)=>{const ix=Math.floor(x/cell),iz=Math.floor(z/cell);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const r of bins.get((ix+dx)+','+(iz+dz))??[]){if(Math.hypot(x-r.x,z-r.z)<Math.max(r.hx,r.hz)*1.5+.25)return true;}return false;};
}
/** 装饰不参与物理。原首视点生成序列冻结，新路线独立采样，不重复叠加。 */
export function generatePlants(terrain:TerrainData,rocks:Rock[]):Plant[]{
 const occupied=rockMask(generateLegacyRocks(terrain)),rand=random(72871),plants:Plant[]=[];
 for(let i=0;i<95000;i++){
  const focus=i>=65000,z=focus?-64+(rand()-.5)*115:-380+rand()*660,x=focus?-310+(rand()-.5)*115:trailX(z)+(rand()-.5)*240;
  if(Math.max(Math.abs(x),Math.abs(z))>Math.min(terrain.size,1024)/2-3||Math.abs(x-trailX(z))<1.3)continue;
  const y=sampleTerrain(terrain,x,z),dx=(sampleTerrain(terrain,x+1,z)-sampleTerrain(terrain,x-1,z))*.5,dz=(sampleTerrain(terrain,x,z+1)-sampleTerrain(terrain,x,z-1))*.5;
  const h=habitatAt(x,z,y+ELEVATION_OFFSET,1-1/Math.hypot(dx,1,dz));
  if(rand()>h.meadow*.87||occupied(x,z))continue;
  const cluster=fieldNoise(x*.065,z*.065),shrub=cluster>.58&&rand()<.075;
  plants.push({x,y:y-.035,z,scale:shrub?.65+rand()*.75:.28+rand()*.42,rotation:rand()*Math.PI*2,tone:rand(),shrub});
 }
 const result=plants.filter(p=>pathClearance(p.x,p.z)>1.3),extra=random(920302),newOccupied=rockMask(rocks);
 for(let i=0;i<230000;i++){
  const d=extra()*routeLength,p=pointAtDistance(d),a=pointAtDistance(d-1),b=pointAtDistance(d+1),len=Math.hypot(b.x-a.x,b.z-a.z),offset=(extra()-.5)*240;
  const x=p.x-(b.z-a.z)/len*offset,z=p.z+(b.x-a.x)/len*offset;
  if((z>-380&&z<280&&Math.abs(x-trailX(z))<120)||Math.max(Math.abs(x),Math.abs(z))>terrain.size/2-3||pathClearance(x,z)<1.3)continue;
  const y=sampleTerrain(terrain,x,z),dx=(sampleTerrain(terrain,x+1,z)-sampleTerrain(terrain,x-1,z))*.5,dz=(sampleTerrain(terrain,x,z+1)-sampleTerrain(terrain,x,z-1))*.5,h=habitatAt(x,z,y+ELEVATION_OFFSET,1-1/Math.hypot(dx,1,dz));
  if(extra()>h.meadow*.92||newOccupied(x,z))continue;
  const shrub=fieldNoise(x*.065,z*.065)>.57&&extra()<.065;
  result.push({x,y:y-.035,z,scale:shrub?.65+extra()*.75:.28+extra()*.42,rotation:extra()*Math.PI*2,tone:extra(),shrub});
 }return result;
}
