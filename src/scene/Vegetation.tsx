import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Float32BufferAttribute,MeshStandardMaterial,DoubleSide,InstancedMesh,Object3D,Color,Group} from 'three';
import {generatePlants,type Plant} from '../world/vegetation';
import {random,type TerrainData,type Rock} from '../world/terrain';

function plantGeometry(shrub:boolean){
 const g=new BufferGeometry(),p:number[]=[],colors:number[]=[],indices:number[]=[],rand=random(shrub?718:371),c=new Color();
 const vertex=(x:number,y:number,z:number)=>{const id=p.length/3;p.push(x,y,z);c.setRGB(.34+y*.4,.4+y*.4,.18+y*.24);colors.push(c.r,c.g,c.b);return id;};
 if(!shrub){
  for(let i=0;i<5;i++){
   const a=rand()*Math.PI*2,r=rand()*.22,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.35+rand()*.6,w=.013+rand()*.022,lean=.18+rand()*.3;
   const dx=Math.cos(a),dz=Math.sin(a),k=p.length/3;
   vertex(x-dz*w,0,z+dx*w);vertex(x+dz*w,0,z-dx*w);
   vertex(x+dx*lean*.35-dz*w*.6,h*.6,z+dz*lean*.35+dx*w*.6);vertex(x+dx*lean*.35+dz*w*.6,h*.6,z+dz*lean*.35-dx*w*.6);
   vertex(x+dx*lean,h,z+dz*lean);indices.push(k,k+1,k+2,k+1,k+3,k+2,k+2,k+3,k+4);
  }
 }else{
  // 真实尺度的叶片簇，不用绿色多面体球冒充灌丛。
  for(let j=0;j<42;j++){
   const a=j*2.399,r=.08+rand()*.4,cx=Math.cos(a)*r,cz=Math.sin(a)*r,h=.12+(.5-r)*.75+rand()*.10,w=.024+rand()*.016,l=.05+rand()*.025,k=p.length/3;
   const dx=Math.cos(a),dz=Math.sin(a);
   vertex(cx-dx*l,h-.018,cz-dz*l);vertex(cx-dz*w,h,cz+dx*w);vertex(cx+dx*l,h+.038,cz+dz*l);vertex(cx+dz*w,h,cz-dx*w);
   indices.push(k,k+1,k+2,k,k+2,k+3);
   const stem=p.length/3;vertex(0,.015,0);vertex(.009,.015,.009);vertex(cx,h,cz);indices.push(stem,stem+1,stem+2);
  }
 }
 g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
function plantMaterial(shrub:boolean){
 const m=new MeshStandardMaterial({vertexColors:true,side:DoubleSide,roughness:1});
 m.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',[
  '#include <begin_vertex>',
  'vec3 plantWorld=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;',
  'float viewFade=1.-smoothstep('+(shrub?'135.,190.':'75.,125.')+',distance(cameraPosition,plantWorld));',
  'transformed.y*=viewFade;'
 ].join('\n'));};m.customProgramCacheKey=()=>shrub?'aotai-shrub-v1':'aotai-grass-v3';return m;
}
function PlantChunk({items,geometry,material,x,z}:{items:Plant[];geometry:BufferGeometry;material:MeshStandardMaterial;x:number;z:number}){
 const ref=useRef<InstancedMesh>(null);
 useEffect(()=>{if(!ref.current)return;const o=new Object3D(),c=new Color();items.forEach((p,i)=>{o.position.set(p.x-x,p.y,p.z-z);o.rotation.set(0,p.rotation,0);o.scale.setScalar(p.scale);o.updateMatrix();ref.current!.setMatrixAt(i,o.matrix);c.setHSL(p.shrub?.23+p.tone*.035:.19+p.tone*.04,.32+p.tone*.12,p.shrub?.20+p.tone*.09:.28+p.tone*.1);ref.current!.setColorAt(i,c);});ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();},[items,x,z]);
 return <instancedMesh ref={ref} position={[x,0,z]} args={[geometry,material,items.length]} receiveShadow />;
}
export default function Vegetation({terrain,rocks,eco}:{terrain:TerrainData;rocks:Rock[];eco:boolean}){
 const all=useMemo(()=>generatePlants(terrain,rocks),[terrain,rocks]);
 const resources=useMemo(()=>({grass:plantGeometry(false),shrub:plantGeometry(true),gm:plantMaterial(false),sm:plantMaterial(true)}),[]);
 const group=useRef<Group>(null),elapsed=useRef(0);
 const chunks=useMemo(()=>{
  const bins=new Map<string,{x:number;z:number;shrub:boolean;items:Plant[]}>();
  all.forEach((p,i)=>{if(eco&&!p.shrub&&i%2) return;const x=Math.floor(p.x/40)*40+20,z=Math.floor(p.z/40)*40+20,key=x+','+z+','+p.shrub;const bin=bins.get(key)??{x,z,shrub:p.shrub,items:[]};bin.items.push(p);bins.set(key,bin);});return [...bins.values()];
 },[all,eco]);
 useFrame(({camera},dt)=>{elapsed.current+=dt;if(elapsed.current<.2)return;elapsed.current=0;group.current?.children.forEach((m,i)=>{m.visible=Math.hypot(camera.position.x-chunks[i].x,camera.position.z-chunks[i].z)<(chunks[i].shrub?220:155);});});
 useEffect(()=>()=>{Object.values(resources).forEach(r=>r.dispose());},[resources]);
 return <group ref={group}>{chunks.map((c,i)=><PlantChunk key={i} {...c} geometry={c.shrub?resources.shrub:resources.grass} material={c.shrub?resources.sm:resources.gm}/>)}</group>;
}
