import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, BufferGeometry, Float32BufferAttribute, Color, InstancedMesh, Object3D, Mesh, MeshStandardMaterial } from 'three';
import { type TerrainData, type MeshData, type Rock, sampleTerrain, trailX, random, buildDistantTerrain, surfaceOrientation } from '../world/terrain';
import { ELEVATION_OFFSET } from '../world/elevation';
import { ROCK_SHAPES } from '../world/rockShape';

/** 仅改变地表着色，不增加伪造高程。纹理细节原创，以米为尺度，无外部贴图请求。 */
function surfaceMaterial(ground: boolean) {
 const material = new MeshStandardMaterial({ vertexColors: ground, roughness: .96, flatShading: !ground });
 material.onBeforeCompile = shader => {
  shader.vertexShader = 'varying vec3 vSurfacePosition;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    vec4 surfacePosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      surfacePosition = instanceMatrix * surfacePosition;
    #endif
    vSurfacePosition = (modelMatrix * surfacePosition).xyz;`);
  shader.fragmentShader = `varying vec3 vSurfacePosition;
    float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float stoneNoise(vec2 p) { vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y); }
  ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
    vec2 p = vSurfacePosition.xz;
    float broad = stoneNoise(p * .17);
    float grain = stoneNoise(p * 7.0 + vSurfacePosition.y * .11);
    float fineFade = 1.0 - smoothstep(.035,.28, length(fwidth(p)));
    float broadFade = 1.0 - smoothstep(1.0, 7.0, length(fwidth(p)));
    diffuseColor.rgb *= 1.0 + (broad - .5) * .2 * broadFade + (grain - .5) * .23 * fineFade;
    ` + (ground ? `
    float trail = 1.0 - smoothstep(.8, 1.8, abs(p.x - (-300.0 + 18.0 * sin(p.y * .009))));
    trail *= smoothstep(-322.,-318.,p.y) * (1.0 - smoothstep(58.,62.,p.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12,1.06,.96),trail*.6);
    ` : ''));
 };
 material.customProgramCacheKey = () => ground ? 'aotai-ground-v2' : 'aotai-granite-v2';
 return material;
}
function terrainGeometry(terrain: MeshData) {
 const geometry = new BufferGeometry();
 geometry.setAttribute('position',new Float32BufferAttribute(terrain.positions,3)); geometry.setIndex(Array.from(terrain.indices)); geometry.computeVertexNormals();
 const colors = new Float32Array(terrain.positions.length), c = new Color(), stone = new Color('#999b97'), lichen = new Color('#767b6b'), meadow = new Color('#827c62'), forest = new Color('#465b4f');
 const normals = geometry.getAttribute('normal');
 for(let i=0;i<terrain.positions.length;i+=3) {
  const x=terrain.positions[i],z=terrain.positions[i+2],height=terrain.positions[i+1]+ELEVATION_OFFSET;
  const patch = .5 + .5*Math.sin(x*.031+Math.sin(z*.023)*1.6)*Math.cos(z*.019);
  const slope = 1-Math.abs(normals.getY(i/3));
  c.copy(stone).lerp(lichen,.28).lerp(meadow,Math.max(0,patch-.24)*.65*(1-slope));
  if(height<3370) c.lerp(forest,Math.min(1,(3370-height)/350));
  c.multiplyScalar(.93+patch*.12); colors.set([c.r,c.g,c.b],i);
 }
 geometry.setAttribute('color',new Float32BufferAttribute(colors,3)); return geometry;
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
function RockGroup({ rocks, variant }: { rocks: Rock[]; variant: number }) {
 const ref=useRef<InstancedMesh>(null);
 const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(ROCK_SHAPES[variant].vertices,3));g.setIndex(ROCK_SHAPES[variant].indices);g.computeVertexNormals();return g;},[variant]);
 const material=useMemo(()=>surfaceMaterial(false),[]);
 useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
 useEffect(()=>{
  if(!ref.current)return;const dummy=new Object3D(),rand=random(72),color=new Color();
  rocks.forEach((r,i)=>{dummy.position.set(r.x,r.y,r.z);if(r.orientation)dummy.quaternion.set(r.orientation.x,r.orientation.y,r.orientation.z,r.orientation.w);else dummy.rotation.set(0,r.rotation,0);dummy.scale.set(r.hx,r.hy,r.hz);dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);color.setHSL(.12+rand()*.02,.045+rand()*.075,.3+rand()*.22);ref.current!.setColorAt(i,color);});
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[rocks]);
 return <instancedMesh ref={ref} args={[geometry,material,rocks.length]} />;
}
function Rocks({rocks}:{rocks:Rock[]}) {
 const groups=useMemo(()=>[0,1,2].map(v=>rocks.filter(r=>(r.variant??0)===v)),[rocks]);
 return <>{groups.map((items,v)=><RockGroup key={v} rocks={items} variant={v} />)}</>;
}
/** 低矮碎石作为地面视觉细节，最高约 8 cm；大岩石仍有同形状凸包碰撞。 */
function Scree({terrain,count}:{terrain:TerrainData;count:number}) {
 const ref=useRef<InstancedMesh>(null);
 useEffect(()=>{
  if(!ref.current)return;const dummy=new Object3D(),rand=random(623),color=new Color();
  for(let i=0;i<count;i++){
   const z=(rand()-.5)*780,x=trailX(z)+(rand()-.5)*(i<count*.75?90:310),s=.12+rand()*.5;
   dummy.position.set(x,sampleTerrain(terrain,x,z)+.025,z);const q=surfaceOrientation(terrain,x,z,rand()*Math.PI);dummy.quaternion.set(q.x,q.y,q.z,q.w);dummy.scale.set(s,.025+rand()*.05,s*(.6+rand()));dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix);
   color.setHSL(.13,.06,.3+rand()*.19);ref.current.setColorAt(i,color);
  }
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[terrain,count]);
 return <instancedMesh ref={ref} args={[undefined,undefined,count]}><octahedronGeometry args={[1,0]} /><meshStandardMaterial flatShading roughness={1} /></instancedMesh>;
}
function Grass({terrain,count}:{terrain:TerrainData;count:number}) {
 const ref=useRef<InstancedMesh>(null);
 const geometry=useMemo(()=>{const g=new BufferGeometry(),vertices:number[]=[];for(let k=0;k<3;k++){const a=k*Math.PI*2/3,dx=Math.cos(a)*.18,dz=Math.sin(a)*.18;vertices.push(-dx,0,-dz,dx,0,dz,dx*.9,.75+k*.12,dz*.8);}g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;},[]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>{
  if(!ref.current)return;const rand=random(887),dummy=new Object3D(),color=new Color();
  for(let i=0;i<count;i++){
   const z=(rand()-.5)*690;let x=trailX(z)+(rand()-.5)*170;
   if(Math.abs(x-trailX(z))<2.2)x+=4;
   const patch=.5+.5*Math.sin(x*.031+Math.sin(z*.023)*1.6)*Math.cos(z*.019);
   const s=.15+rand()*.34;dummy.position.set(x,sampleTerrain(terrain,x,z)-.025,z);dummy.scale.set(s*2.2,s*(.6+patch),s*2.2);dummy.rotation.set(0,rand()*Math.PI*2,0);dummy.updateMatrix();ref.current.setMatrixAt(i,dummy.matrix);
   color.setHSL(.11+rand()*.07,.17+rand()*.12,.23+rand()*.18);ref.current.setColorAt(i,color);
  }
  ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();
 },[terrain,count]);
 return <instancedMesh ref={ref} args={[geometry,undefined,count]}><meshStandardMaterial roughness={1} side={2} /></instancedMesh>;
}
export default function Landscape({terrain,rocks,eco}:{terrain:TerrainData;rocks:Rock[];eco:boolean}) {
 const ground=useMemo(()=>terrainGeometry(terrain),[terrain]);
 const mountains=useMemo(()=>terrainGeometry(buildDistantTerrain(terrain)),[terrain]);
 const material=useMemo(()=>surfaceMaterial(true),[]);
 useEffect(()=>()=>{ground.dispose();mountains.dispose();material.dispose();},[ground,mountains,material]);
 return <>
  <color attach="background" args={['#c5d1d1']} /><fogExp2 attach="fog" args={['#c5d1d1',.00042]} />
  <Sky /><hemisphereLight args={['#d8e6ee','#494439',1.65]} />
  <directionalLight position={[-1500,2200,-1000]} color="#fff3df" intensity={2.3} />
  <mesh geometry={ground} material={material} /><mesh geometry={mountains} material={material} />
  <Rocks rocks={rocks} /><Scree terrain={terrain} count={eco?2400:6500} /><Grass terrain={terrain} count={eco?2600:7000} />
 </>;
}
