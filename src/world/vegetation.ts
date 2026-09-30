import { type TerrainData, type Rock, sampleTerrain, random, trailX } from './terrain';
import { habitatAt, fieldNoise } from './habitat';
import { ELEVATION_OFFSET } from './elevation';
export interface Plant {x:number;y:number;z:number;scale:number;rotation:number;tone:number;shrub:boolean}
/** 小草与低矮丛状植被艺术模型。分区与地表一致，排除大岩块及行走带。 */
export function generatePlants(terrain:TerrainData,rocks:Rock[]):Plant[]{
 const bins=new Map<string,Rock[]>(),cell=8;
 for(const r of rocks){const k=Math.floor(r.x/cell)+','+Math.floor(r.z/cell);const a=bins.get(k)??[];a.push(r);bins.set(k,a);}
 const occupied=(x:number,z:number)=>{const ix=Math.floor(x/cell),iz=Math.floor(z/cell);for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const r of bins.get((ix+dx)+','+(iz+dz))??[]){const rr=Math.max(r.hx,r.hz)*1.5+.25;if(Math.hypot(x-r.x,z-r.z)<rr)return true;}return false;};
 const rand=random(72871),plants:Plant[]=[];
 for(let i=0;i<95000;i++){
  const focus=i>=65000,z=focus?-64+(rand()-.5)*115:-380+rand()*660,x=focus?-310+(rand()-.5)*115:trailX(z)+(rand()-.5)*240;
  if(Math.max(Math.abs(x),Math.abs(z))>terrain.size/2-3||Math.abs(x-trailX(z))<1.3)continue;
  const y=sampleTerrain(terrain,x,z),dx=(sampleTerrain(terrain,x+1,z)-sampleTerrain(terrain,x-1,z))*.5,dz=(sampleTerrain(terrain,x,z+1)-sampleTerrain(terrain,x,z-1))*.5;
  const h=habitatAt(x,z,y+ELEVATION_OFFSET,1-1/Math.hypot(dx,1,dz));
  if(rand()>h.meadow*.87||occupied(x,z))continue;
  const cluster=fieldNoise(x*.065,z*.065),shrub=cluster>.58&&rand()<.075;
  plants.push({x,y:y-.035,z,scale:shrub?.65+rand()*.75:.28+rand()*.42,rotation:rand()*Math.PI*2,tone:rand(),shrub});
 }
 return plants;
}
