import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, BufferGeometry, Float32BufferAttribute, Color, InstancedMesh, Object3D, Mesh } from 'three';
import { type TerrainData, type MeshData, type Rock, sampleTerrain, trailX, random, buildDistantTerrain, surfaceOrientation, terrainHeight } from '../world/terrain';
import { ROCK_SHAPES } from '../world/rockShape';
import { stoneRiverCenter } from '../world/habitat';
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
function RockGroup({ rocks, variant, textures, size }: { rocks: Rock[]; variant: number; textures: SurfaceTextures; size:number }) {
 const ref=useRef<InstancedMesh>(null);
 const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(ROCK_SHAPES[variant].vertices,3));g.setIndex(ROCK_SHAPES[variant].indices);g.computeVertexNormals();return g;},[variant]);
 const material=useMemo(()=>createSurfaceMaterial(false,textures,size),[textures,size]);
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 useEffect(()=>{
  if(!ref.current)return;const dummy=new Object3D(),rand=random(72),color=new Color();
  rocks.forEach((r,i)=>{dummy.position.set(r.x,r.y,r.z);if(r.orientation)dummy.quaternion.set(r.orientation.x,r.orientation.y,r.orientation.z,r.orientation.w);else dummy.rotation.set(0,r.rotation,0);dummy.scale.set(r.hx,r.hy,r.hz);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);color.setHSL(.12+rand()*.02,.025+rand()*.05,.52+rand()*.17);ref.current!.setColorAt(i,color);});
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[rocks]);
 return <instancedMesh ref={ref} args={[geometry,material,rocks.length]} castShadow receiveShadow />;
}
function Rocks({rocks,textures,size}:{rocks:Rock[];textures:SurfaceTextures;size:number}) {
 const groups=useMemo(()=>[0,1,2].map(v=>rocks.filter(r=>(r.variant??0)===v)),[rocks]);
 return <>{groups.map((items,v)=><RockGroup key={v} rocks={items} variant={v} textures={textures} size={size} />)}</>;
}

function Scree({terrain,eco}:{terrain:TerrainData;eco:boolean}){
 const ref=useRef<InstancedMesh>(null),count=eco?2800:5800;
 useEffect(()=>{
  if(!ref.current)return;const rand=random(623),o=new Object3D(),c=new Color();
  for(let i=0;i<count;i++){
   const z=(rand()-.5)*760,x=i<count*.85?stoneRiverCenter(z)+(rand()-.5)*76:trailX(z)+(rand()-.5)*100,s=.13+rand()*.42;
   const q=surfaceOrientation(terrain,x,z,rand()*Math.PI);o.position.set(x,sampleTerrain(terrain,x,z)+.025,z);o.quaternion.set(q.x,q.y,q.z,q.w);o.scale.set(s,.035+rand()*.055,s*(.6+rand()));o.updateMatrix();ref.current.setMatrixAt(i,o.matrix);c.setHSL(.12,.035,.38+rand()*.24);ref.current.setColorAt(i,c);
  }
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[terrain,count]);
 return <instancedMesh ref={ref} args={[undefined,undefined,count]} receiveShadow><octahedronGeometry args={[1,0]}/><meshStandardMaterial flatShading roughness={1}/></instancedMesh>;
}
export default function Landscape({terrain,rocks,eco}:{terrain:TerrainData;rocks:Rock[];eco:boolean}){
 const ground=useMemo(()=>terrainGeometry(terrain),[terrain]);
 const mountains=useMemo(()=>terrainGeometry(buildDistantTerrain(terrain)),[terrain]);
 const textures=useMemo(()=>createSurfaceTextures(terrain),[terrain]);
 const material=useMemo(()=>createSurfaceMaterial(true,textures,terrain.size),[textures,terrain.size]);
 const target=useMemo(()=>{const t=new Object3D();t.position.set(-310,710,-64);return t;},[]);
 useEffect(()=>()=>{ground.dispose();mountains.dispose();material.dispose();textures.detail.dispose();textures.habitat.dispose();textures.farHabitat.dispose();},[ground,mountains,material,textures]);
 return <>
  <color attach="background" args={['#b9cbd2']}/><fogExp2 attach="fog" args={['#b9cbd2',.00024]}/>
  <Sky/><hemisphereLight args={['#d7e5f4','#555437',.95]}/>
  <primitive object={target}/>
  <directionalLight position={[-530,1040,90]} target={target} color="#fff4df" intensity={2.5} castShadow={!eco}
   shadow-mapSize={[2048,2048]} shadow-camera-left={-185} shadow-camera-right={185} shadow-camera-top={185} shadow-camera-bottom={-185}
   shadow-camera-near={1} shadow-camera-far={700} shadow-normalBias={.1} shadow-bias={-.0003} shadow-autoUpdate={false} shadow-needsUpdate={true}/>
  <mesh geometry={ground} material={material} receiveShadow/><mesh geometry={mountains} material={material}/>
  <Rocks rocks={rocks} textures={textures} size={terrain.size}/><Scree terrain={terrain} eco={eco}/><Vegetation terrain={terrain} rocks={rocks} eco={eco}/>
 </>;
}
