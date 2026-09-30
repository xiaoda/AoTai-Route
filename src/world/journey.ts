/** 虚拟体验路线的唯一平面配置。所有坐标为米，不是现实 GPS 轨迹。 */
export const LEGACY_START_Z=60, LEGACY_END_Z=-320;
export const legacyTrailX=(z:number)=>-300+18*Math.sin(z*.009);
const approach=[[-520,920],[-620,720],[-650,560],[-590,430],[-500,290],[-390,160],[-310,90]];
const onward=[[-270,-364],[-230,-385],[-150,-408],[-75,-430],[-20,-485],[20,-550],[55,-620],[100,-716],[130,-810],[192,-934]];
export const ROUTE_CONTROL_POINTS= [
 ...approach,
 ...Array.from({length:LEGACY_START_Z-LEGACY_END_Z+1},(_,i)=>{const z=LEGACY_START_Z-i;return [legacyTrailX(z),z];}),
 ...onward,
].map(([x,z])=>({x,z}));
export const SCENIC_POINTS=[
 {id:'ridge',name:'风脊草坡',shortName:'风脊',x:-650,z:560,yaw:-.60,footPitch:-.10,airPitch:-.30,description:'草甸沿山脊铺开，近看低矮草叶，远看两侧落差。',evidence:'DEM 山脊与坡度；国家林草局高山草甸资料。'},
 {id:'stone-river',name:'石河与草甸',shortName:'石河',x:legacyTrailX(-64),z:-64,yaw:1.05,footPitch:-.22,airPitch:-.43,description:'灰白块石带沿坡面延展，与连续草甸相接。',evidence:'国家林草局石河照片，仅地貌参考，非同机位复刻。'},
 {id:'valley',name:'谷地与群峰',shortName:'远眺',x:130,z:-810,yaw:2.436,footPitch:-.24,airPitch:-.38,description:'从裸露山肩俯看谷地与相叠山脊。',evidence:'同源 DEM 的谷地/山肩相对高差；不声明为大爷海或实测机位。'},
] as const;
