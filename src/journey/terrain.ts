import { MAP_BOUNDS, type Coordinate } from './landmarks';
export type RegionTerrain={schemaVersion:number;bounds:typeof MAP_BOUNDS;columns:number;rows:number;heights:number[]};
export function validateTerrain(value:unknown):RegionTerrain{
 const d=value as RegionTerrain;
 if(!d||d.schemaVersion!==1||d.columns!==481||d.rows!==261||!Array.isArray(d.heights)||d.heights.length!==d.columns*d.rows||Object.keys(MAP_BOUNDS).some(k=>d.bounds?.[k as keyof typeof MAP_BOUNDS]!==MAP_BOUNDS[k as keyof typeof MAP_BOUNDS])||d.heights.some(h=>!Number.isFinite(h)||h<0||h>4500))throw Error('区域地形数据无效，请重新加载');
 return d;
}
export function sampleRegion(d:RegionTerrain,p:Coordinate){
 const x=Math.max(0,Math.min(d.columns-1,(p.lon-d.bounds.west)/(d.bounds.east-d.bounds.west)*(d.columns-1))),y=Math.max(0,Math.min(d.rows-1,(d.bounds.north-p.lat)/(d.bounds.north-d.bounds.south)*(d.rows-1)));
 const i=Math.min(d.columns-2,Math.floor(x)),j=Math.min(d.rows-2,Math.floor(y)),u=x-i,v=y-j;
 return d.heights[j*d.columns+i]*(1-u)*(1-v)+d.heights[j*d.columns+i+1]*u*(1-v)+d.heights[(j+1)*d.columns+i]*(1-u)*v+d.heights[(j+1)*d.columns+i+1]*u*v;
}
/** 区域等距近似，单位千米，高程不夸大。 */
export function regionPoint(p:Coordinate,elevation:number){return {x:(p.lon-107.585)*92.4,y:(elevation-1500)/1000,z:(33.94-p.lat)*111.2};}
