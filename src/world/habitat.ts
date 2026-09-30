/** 太白高山区的原创地貌分区。参考石河/草甸形态，不是实测植被覆盖图。
 * 米制局部坐标；不改变任何 DEM 高程。地表材质、草丛和岩块共用此采样。
 */
export const clamp01 = (v:number) => Math.max(0,Math.min(1,v));
export const smooth = (a:number,b:number,x:number) => {const t=clamp01((x-a)/(b-a));return t*t*(3-2*t);};
const fract=(v:number)=>v-Math.floor(v);
const hash=(x:number,z:number)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
export function fieldNoise(x:number,z:number):number {
 const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);
 return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v;
}
export const stoneRiverCenter=(z:number)=>-346+.35*(z+64)+9*Math.sin(z*.017);
export function habitatAt(x:number,z:number,elevation:number,slope:number) {
 if(![x,z,elevation,slope].every(Number.isFinite))throw new Error('地表分区输入无效');
 const patch=fieldNoise(x*.018,z*.018),detail=fieldNoise(x*.12,z*.12);
 const ribbon=1-smooth(18,43,Math.abs(x-stoneRiverCenter(z))+(detail-.5)*9);
 const extent=1-smooth(340,520,Math.abs(z));
 const bare=smooth(.08,.28,slope)*(.65+.35*fieldNoise(x*.014,z*.004)),summit=smooth(3730,3790,elevation)*.36;
 const stone=clamp01(Math.max(ribbon*extent*.96,bare,smooth(.4,.75,slope),.06+summit+(1-smooth(.20,.4,patch))*.18));
 const soil=(1-stone)*(.035+detail*.045);
 return {stone,soil,meadow:1-stone-soil};
}
