import { DataTexture, RGBAFormat, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial } from 'three';
import { habitatAt, smooth } from '../world/habitat';
import { sampleTerrain, type TerrainData, trailX } from '../world/terrain';
import { ELEVATION_OFFSET, elevationAt, DEM } from '../world/elevation';

/** 原创材质细节，非摄影扫描；通道分别为岩石、草甸与土壤的细节高度。 */
export function createSurfaceTextures(terrain: TerrainData) {
 const n=256,bytes=new Uint8Array(n*n*4);
 const hash=(x:number,z:number)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);};
 const tileNoise=(u:number,v:number,scale:number)=>{
  const x=u*scale,z=v*scale,ix=Math.floor(x),iz=Math.floor(z),a=smooth(0,1,x-ix),b=smooth(0,1,z-iz);
  const h=(i:number,j:number)=>hash((i+scale)%scale,(j+scale)%scale);
  return (h(ix,iz)*(1-a)+h(ix+1,iz)*a)*(1-b)+(h(ix,iz+1)*(1-a)+h(ix+1,iz+1)*a)*b;
 };
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const u=i/n,v=j/n,grain=tileNoise(u,v,96),broad=tileNoise(u,v,8),fine=tileNoise(u,v,32);
  const x=u*7,z=v*7,ix=Math.floor(x),iz=Math.floor(z);let nearest=9,second=9;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const gx=ix+dx,gz=iz+dy,px=gx+.18+.64*hash((gx+7)%7,(gz+7)%7),pz=gz+.18+.64*hash((gz+7)%7+37,(gx+7)%7+5),d=Math.hypot(x-px,z-pz);
   if(d<nearest){second=nearest;nearest=d;}else second=Math.min(second,d);
  }
  const crack=smooth(.015,.11,second-nearest),k=(j*n+i)*4;
  bytes[k]=Math.round(255*(.25+.24*broad+.24*grain+.17*crack));
  bytes[k+1]=Math.round(255*(.22+.27*fine+.38*grain));
  bytes[k+2]=Math.round(255*(.22+.32*broad+.36*grain));bytes[k+3]=255;
 }
 const detail=new DataTexture(bytes,n,n,RGBAFormat);detail.wrapS=detail.wrapT=RepeatWrapping;detail.magFilter=LinearFilter;detail.minFilter=LinearMipmapLinearFilter;detail.generateMipmaps=true;detail.anisotropy=4;detail.needsUpdate=true;
 const createCover=(worldSize:number,near:boolean)=>{
  const size=512,map=new Uint8Array(size*size*4),step=worldSize/(size-1),half=worldSize/2;
  const sample=(x:number,z:number)=>near?sampleTerrain(terrain,x,z):elevationAt(Math.max(-half,Math.min(half,x)),Math.max(-half,Math.min(half,z)))-ELEVATION_OFFSET;
  for(let j=0;j<size;j++)for(let i=0;i<size;i++){
   const x=i*step-half,z=j*step-half,h=sample(x,z),dx=(sample(x+2,z)-sample(x-2,z))*.25,dz=(sample(x,z+2)-sample(x,z-2))*.25;
   const f=habitatAt(x,z,h+ELEVATION_OFFSET,1-1/Math.hypot(dx,1,dz)),k=(j*size+i)*4;
   const path=near?(1-smooth(.7,1.6,Math.abs(x-trailX(z))))*smooth(-324,-318,z)*(1-smooth(58,64,z)):0;
   map[k]=Math.round(f.stone*255);map[k+1]=Math.round(f.meadow*255);map[k+2]=Math.round(path*255);map[k+3]=255;
  }
  const t=new DataTexture(map,size,size,RGBAFormat);t.magFilter=LinearFilter;t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
 };
 return {detail,habitat:createCover(terrain.size,true),farHabitat:createCover(DEM.far.size,false)};
}
export type SurfaceTextures=ReturnType<typeof createSurfaceTextures>;
export function createSurfaceMaterial(ground:boolean,textures:SurfaceTextures,size:number) {
 const m=new MeshStandardMaterial({vertexColors:false,roughness:.96,flatShading:!ground});
 m.onBeforeCompile=shader=>{
  shader.uniforms.uDetail={value:textures.detail};shader.uniforms.uHabitat={value:textures.habitat};shader.uniforms.uGroundSize={value:size};shader.uniforms.uFarHabitat={value:textures.farHabitat};shader.uniforms.uFarSize={value:DEM.far.size};
  shader.vertexShader='varying vec3 vLand; varying vec3 vShape; varying vec3 vCover;\n'+(ground?'attribute vec3 cover;\n':'')+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',[
   '#include <begin_vertex>',
   'vShape=position;vec4 land=vec4(position,1.);',
   '#ifdef USE_INSTANCING',
   'land=instanceMatrix*land;',
   '#endif',
   'vLand=(modelMatrix*land).xyz;',
   'vCover='+(ground?'cover':'vec3(1.,0.,0.)')+';'
  ].join('\n'));
  shader.fragmentShader=[
   'uniform sampler2D uDetail;uniform sampler2D uHabitat;uniform float uGroundSize;uniform sampler2D uFarHabitat;uniform float uFarSize;',
   'varying vec3 vLand;varying vec3 vShape;varying vec3 vCover;',
   'vec3 landBump(vec3 p,vec3 n,float h){vec3 sx=dFdx(p),sy=dFdy(p),r1=cross(sy,n),r2=cross(n,sx);float det=dot(sx,r1);vec3 g=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(abs(det)*n-g);}',
   shader.fragmentShader
  ].join('\n');
  const common=['#include <color_fragment>',
   'vec3 detail=texture2D(uDetail,vLand.xz*.28).rgb;',
   'float broad=texture2D(uDetail,vLand.xz*.018).g;',
   'float tiny=texture2D(uDetail,vLand.xz*1.7).g;',
   'float surfaceHeight;'];
  const land=[
   'vec3 cover=texture2D(uFarHabitat,vLand.xz/uFarSize+.5).rgb;',
   'if(max(abs(vLand.x),abs(vLand.z))<uGroundSize*.5-2.)cover=texture2D(uHabitat,vLand.xz/uGroundSize+.5).rgb;',
   'vec3 meadow=mix(vec3(.024,.054,.018),vec3(.105,.153,.044),broad);',
   'meadow*=.43+detail.g*.76+tiny*.42;',
   'vec3 stone=mix(vec3(.21,.235,.235),vec3(.53,.535,.49),detail.r);',
   'vec3 soil=vec3(.19,.16,.105)*(.6+detail.b*.85);',
   'diffuseColor.rgb=mix(stone,meadow,cover.g);',
   'diffuseColor.rgb=mix(diffuseColor.rgb,soil,cover.b*.68);',
   'surfaceHeight=mix(detail.r*.065,detail.g*.065,cover.g);'];
  const rock=[
   'vec3 weights=pow(abs(normalize(cross(dFdx(vLand),dFdy(vLand)))),vec3(4.));weights/=max(dot(weights,vec3(1.)),.001);',
   'float stone=texture2D(uDetail,vLand.zy*.46).r*weights.x+detail.r*weights.y+texture2D(uDetail,vLand.xy*.46).r*weights.z;',
   'float base=smoothstep(-.8,.35,vShape.y);',
   'diffuseColor.rgb*=(.54+stone*.77)*mix(.55,1.,base);',
   'surfaceHeight=stone*.048;'];
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',common.concat(ground?land:rock).join('\n'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',[
   '#include <normal_fragment_maps>',
   'float detailFade=1.-smoothstep(90.,220.,length(vViewPosition));',
   'normal=landBump(-vViewPosition,normal,surfaceHeight*detailFade);'
  ].join('\n'));
 };
 m.customProgramCacheKey=()=>ground?'aotai-meadow-v3':'aotai-granite-v3';return m;
}
export function groundCover(x:number,z:number,height:number,normalY:number){
 const h=habitatAt(x,z,height+ELEVATION_OFFSET,1-Math.abs(normalY));return [h.stone,h.meadow,0];
}
