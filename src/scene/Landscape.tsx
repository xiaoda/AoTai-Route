import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, BufferGeometry, Float32BufferAttribute, Color, InstancedMesh, Object3D, Mesh, DirectionalLight, MeshStandardMaterial } from 'three';
import { type TerrainData, type MeshData, type Rock, sampleTerrain, trailX, random, buildDistantTerrain, surfaceOrientation, terrainHeight } from '../world/terrain';
import { ROCK_SHAPES } from '../world/rockShape';
import { stoneRiverCenter } from '../world/habitat';
import { pathClearance, pointAtDistance, routeLength } from '../world/route';
import { DEM } from '../world/elevation';
import { createSurfaceTextures, createSurfaceMaterial, groundCover, type SurfaceTextures } from './surface';
import Vegetation from './Vegetation';
function terrainGeometry(t:MeshData){
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(t.positions,3));g.setIndex(Array.from(t.indices));g.computeVertexNormals();
 const normals=g.getAttribute('normal'),cover=new Float32Array(t.positions.length);
 // 远近网格共用连续高程梯度，避免接缝处因三角形大小不同产生明暗折线。
 const half=DEM.far.size/2;
 const sample=(x:number,z:number)=>terrainHeight(Math.max(-half,Math.min(half,x)),Math.max(-half,Math.min(half,z)));
 for(let i=0;i<t.positions.length;i+=3){const x=t.positions[i],z=t.positions[i+2],dx=sample(x+2,z)-sample(x-2,z),dz=sample(x,z+2)-sample(x,z-2),len=Math.hypot(dx,4,dz);normals.setXYZ(i/3,-dx/len,4/len,-dz/len);}
 for(let i=0;i<t.positions.length;i+=3)cover.set(groundCover(t.positions[i],t.positions[i+2],t.positions[i+1],normals.getY(i/3)),i);
 g.setAttribute('cover',new Float32BufferAttribute(cover,3));return g;
}
function Sky() {
 const ref=useRef<Mesh>(null);
 useFrame(({camera})=>{ref.current?.position.copy(camera.position);});
 return <mesh ref={ref} renderOrder={-1}><sphereGeometry args={[6500,32,16]} />
  <shaderMaterial side={BackSide} depthWrite={false} toneMapped={false} vertexShader={`varying vec3 vSky; void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`} fragmentShader={`
   varying vec3 vSky;
   void main(){vec3 d=normalize(vSky);float t=pow(max(d.y,0.),.55);vec3 c=mix(vec3(.77,.82,.82),vec3(.31,.49,.63),t);float sun=max(dot(d,normalize(vec3(-.65,.62,-.44))),0.);c+=vec3(.28,.22,.12)*pow(sun,28.)+vec3(.9,.75,.45)*pow(sun,1800.);gl_FragColor=vec4(c,1.);}
  `} />
 </mesh>;
}
type RockInstance={rock:Rock;color:Color};
function RockGroup({items,geometry,material}:{items:RockInstance[];geometry:BufferGeometry;material:MeshStandardMaterial}) {
 const ref=useRef<InstancedMesh>(null);
 useEffect(()=>{
  if(!ref.current)return;const dummy=new Object3D();
  items.forEach(({rock:r,color},i)=>{dummy.position.set(r.x,r.y,r.z);if(r.orientation)dummy.quaternion.set(r.orientation.x,r.orientation.y,r.orientation.z,r.orientation.w);else dummy.rotation.set(0,r.rotation,0);dummy.scale.set(r.hx,r.hy,r.hz);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);ref.current!.setColorAt(i,color);});
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[items]);
 return <instancedMesh ref={ref} args={[geometry,material,items.length]} castShadow receiveShadow />;
}
function Rocks({rocks,textures,size}:{rocks:Rock[];textures:SurfaceTextures;size:number}) {
 const geometries=useMemo(()=>ROCK_SHAPES.map(shape=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(shape.vertices,3));g.setIndex(shape.indices);g.computeVertexNormals();return g;}),[]);
 const material=useMemo(()=>createSurfaceMaterial(false,textures,size),[textures,size]);
 useEffect(()=>()=>{geometries.forEach(g=>g.dispose());material.dispose();},[geometries,material]);
 const groups=useMemo(()=>[0,1,2].flatMap(variant=>{
  const cells=new Map<string,RockInstance[]>(),rand=random(72);
  // 先按旧变体顺序取颜色，再分块；首视点色彩不因裁剪分块改变。
  for(const rock of rocks.filter(r=>(r.variant??0)===variant)){
   const color=new Color().setHSL(.12+rand()*.02,.025+rand()*.05,.52+rand()*.17),key=Math.floor(rock.x/256)+':'+Math.floor(rock.z/256);
   const items=cells.get(key)??[];items.push({rock,color});cells.set(key,items);
  }
  return Array.from(cells,([key,items])=>({key:variant+':'+key,variant,items}));
 }),[rocks]);
 // 每块独立视锥裁剪，不删除远景实例，也不改变碰撞世界。
 return <>{groups.map(g=><RockGroup key={g.key} items={g.items} geometry={geometries[g.variant]} material={material}/>)}</>;
}

function Scree({terrain,eco}:{terrain:TerrainData;eco:boolean}){
 const ref=useRef<InstancedMesh>(null),legacyCount=eco?2800:5800,count=legacyCount+(eco?2800:5400);
 useEffect(()=>{
  if(!ref.current)return;const rand=random(623),extra=random(920303),o=new Object3D(),c=new Color();
  for(let i=0;i<count;i++){
   let x:number,z:number,s:number,spin:number,hy:number,depth:number,tone:number;
   if(i<legacyCount){
    z=(rand()-.5)*760;x=i<legacyCount*.85?stoneRiverCenter(z)+(rand()-.5)*76:trailX(z)+(rand()-.5)*100;s=.13+rand()*.42;
    spin=rand()*Math.PI;hy=.035+rand()*.055;depth=s*(.6+rand());tone=.38+rand()*.24;
   }else{
    const d=extra()*routeLength,p=pointAtDistance(d),ahead=pointAtDistance(Math.min(routeLength,d+2)),behind=pointAtDistance(Math.max(0,d-2)),dx=ahead.x-behind.x,dz=ahead.z-behind.z,len=Math.hypot(dx,dz),offset=(extra()-.5)*90;
    x=p.x-dz/len*offset;z=p.z+dx/len*offset;s=.13+extra()*.34;spin=extra()*Math.PI;hy=.035+extra()*.045;depth=s*(.6+extra());tone=.38+extra()*.24;
    // 新批碎石不叠加已验收核心，也不占据步行净空。
    if((z>-400&&z<400)||pathClearance(x,z)<1.6)s=0;
   }
   const q=surfaceOrientation(terrain,x,z,spin);o.position.set(x,sampleTerrain(terrain,x,z)+.025,z);o.quaternion.set(q.x,q.y,q.z,q.w);o.scale.set(s,hy,s===0?0:depth);o.updateMatrix();ref.current.setMatrixAt(i,o.matrix);c.setHSL(.12,.035,tone);ref.current.setColorAt(i,c);
  }
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[terrain,count,legacyCount]);
 return <instancedMesh ref={ref} args={[undefined,undefined,count]} receiveShadow><octahedronGeometry args={[1,0]}/><meshStandardMaterial flatShading roughness={1}/></instancedMesh>;
}
function SunLight({eco}:{eco:boolean}){
 const light=useRef<DirectionalLight>(null),last=useRef({x:Infinity,z:Infinity});
 const target=useMemo(()=>new Object3D(),[]);
 useFrame(({camera})=>{
  const x=Math.round(camera.position.x/64)*64,z=Math.round(camera.position.z/64)*64;
  if(!light.current||last.current.x===x&&last.current.z===z)return;
  last.current={x,z};const y=terrainHeight(x,z);
  target.position.set(x,y,z);target.updateMatrixWorld();light.current.position.set(x-220,y+330,z+154);light.current.shadow.needsUpdate=true;
 });
 useEffect(()=>{if(light.current)light.current.shadow.needsUpdate=true;},[eco]);
 return <><primitive object={target}/><directionalLight ref={light} target={target} color="#fff4df" intensity={2.5} castShadow={!eco}
  shadow-mapSize={[2048,2048]} shadow-camera-left={-185} shadow-camera-right={185} shadow-camera-top={185} shadow-camera-bottom={-185}
  shadow-camera-near={1} shadow-camera-far={700} shadow-normalBias={.1} shadow-bias={-.0003} shadow-autoUpdate={false} shadow-needsUpdate={true}/></>;
}
export default function Landscape({terrain,rocks,eco}:{terrain:TerrainData;rocks:Rock[];eco:boolean}){
 const ground=useMemo(()=>terrainGeometry(terrain),[terrain]);
 const mountains=useMemo(()=>terrainGeometry(buildDistantTerrain(terrain)),[terrain]);
 const textures=useMemo(()=>createSurfaceTextures(terrain),[terrain]);
 const material=useMemo(()=>createSurfaceMaterial(true,textures,terrain.size),[textures,terrain.size]);
 useEffect(()=>()=>{ground.dispose();mountains.dispose();material.dispose();textures.detail.dispose();textures.habitat.dispose();textures.farHabitat.dispose();},[ground,mountains,material,textures]);
 return <>
  <color attach="background" args={['#b9cbd2']}/><fogExp2 attach="fog" args={['#b9cbd2',.00024]}/>
  <Sky/><hemisphereLight args={['#d7e5f4','#555437',.95]}/>
  <SunLight eco={eco}/>
  <mesh geometry={ground} material={material} receiveShadow/><mesh geometry={mountains} material={material}/>
  <Rocks rocks={rocks} textures={textures} size={terrain.size}/><Scree terrain={terrain} eco={eco}/><Vegetation terrain={terrain} rocks={rocks} eco={eco}/>
 </>;
}
