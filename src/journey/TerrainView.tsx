import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { LANDMARKS } from './landmarks';
import { regionPoint, sampleRegion, validateTerrain, type RegionTerrain } from './terrain';

function TerrainMesh({data}:{data:RegionTerrain}){
 const geometry=useMemo(()=>{
  const g=new BufferGeometry(),vertices:number[]=[],colors:number[]=[],indices:number[]=[];
  for(let j=0;j<data.rows;j++)for(let i=0;i<data.columns;i++){
   const h=data.heights[j*data.columns+i],lon=data.bounds.west+i/(data.columns-1)*(data.bounds.east-data.bounds.west),lat=data.bounds.north-j/(data.rows-1)*(data.bounds.north-data.bounds.south),p=regionPoint({lon,lat},h);
   vertices.push(p.x,p.y,p.z);const t=Math.max(0,Math.min(1,(h-1800)/1900));colors.push(.10+.23*t,.18+.21*t,.13+.18*t);
   if(i<data.columns-1&&j<data.rows-1){const a=j*data.columns+i,b=a+1,c=a+data.columns,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  g.setAttribute('position',new Float32BufferAttribute(vertices,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
 },[data]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={1}/></mesh>;
}
type ProjectedLabel={index:number;x:number;y:number};
function ProjectedLabels({data,onChange}:{data:RegionTerrain;onChange(labels:ProjectedLabel[]):void}){
 const elapsed=useRef(0),previous=useRef('');
 useFrame(({camera},dt)=>{elapsed.current+=dt;if(elapsed.current<.1)return;elapsed.current=0;
  const labels=LANDMARKS.map((p,index)=>{const xyz=regionPoint(p.coordinate,sampleRegion(data,p.coordinate));const v=new Vector3(xyz.x,xyz.y+.12,xyz.z).project(camera);return {index,x:Math.round((v.x+1)*500)/10,y:Math.round((1-v.y)*500)/10,z:v.z};}).filter(p=>p.z>-1&&p.z<1&&p.x>3&&p.x<97&&p.y>8&&p.y<89).map(({index,x,y})=>({index,x,y}));
  const key=JSON.stringify(labels);if(key!==previous.current){previous.current=key;onChange(labels);}
 });return null;
}
function CameraRig({data,index,lookBack,reduced}:{data:RegionTerrain;index:number;lookBack:boolean;reduced:boolean}){
 const first=useRef(true);
 const poses=useMemo(()=>{
  const anchor=LANDMARKS[index],p=regionPoint(anchor.coordinate,sampleRegion(data,anchor.coordinate));
  const reference=LANDMARKS[lookBack?Math.max(0,index-1):Math.min(index+1,LANDMARKS.length-1)];
  const r=regionPoint(reference.coordinate,sampleRegion(data,reference.coordinate));
  const direction=new Vector3(r.x-p.x,0,r.z-p.z);if(direction.length()<.2)direction.set(lookBack?-1:1,0,-.12);direction.normalize();
  const target=new Vector3(p.x+direction.x*.9,p.y,p.z+direction.z*.9);
  const eye=new Vector3(p.x-direction.x*4.4,p.y+3.8,p.z-direction.z*4.4+2.5);
  return {eye,target};
 },[data,index,lookBack]);
 const target=useRef(new Vector3());
 useFrame(({camera},dt)=>{if(first.current||reduced){camera.position.copy(poses.eye);target.current.copy(poses.target);first.current=false;}else{const alpha=1-Math.exp(-Math.min(dt,.05)*2.5);camera.position.lerp(poses.eye,alpha);target.current.lerp(poses.target,alpha);}camera.lookAt(target.current);});
 return null;
}
export default function TerrainView({index,reduced}:{index:number;reduced:boolean}){
 const [labels,setLabels]=useState<ProjectedLabel[]>([]);
 const [data,setData]=useState<RegionTerrain|null>(null),[error,setError]=useState(''),[lookBack,setLookBack]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const ac=new AbortController();setError('');fetch('/journey/terrain.json',{signal:ac.signal}).then(r=>{if(!r.ok)throw Error('地形加载失败');return r.json();}).then(validateTerrain).then(setData).catch(e=>{if(e.name!=='AbortError')setError(String(e.message));});return()=>ac.abort();},[attempt]);
 useEffect(()=>setLookBack(false),[index]);
 return <div className="terrain-view">
  {!data&&!error&&<div className="terrain-message" role="status">正在展开立体地形…<small>本地 DEM · 不请求在线地图</small></div>}
  {error&&<div className="terrain-message" role="alert">{error}<button onClick={()=>setAttempt(a=>a+1)}>重试</button><small>也可切回地理地图继续导览。</small></div>}
  {data&&<Canvas aria-label="基于真实高程的立体山地示意" dpr={[1,1.5]} camera={{fov:48,near:.05,far:100}} gl={{antialias:true}} fallback={<div className="terrain-message">三维地形画布；无法显示时可切回地理地图。</div>}>
   <color attach="background" args={['#dce2d4']}/><fog attach="fog" args={['#dce2d4',24,65]}/>
   <hemisphereLight args={['#ffffeb','#586950',1.0]}/><directionalLight position={[-10,18,-12]} intensity={1.8}/>
   <TerrainMesh data={data}/><CameraRig data={data} index={index} lookBack={lookBack} reduced={reduced}/>
   <ProjectedLabels data={data} onChange={setLabels}/>
  </Canvas>}
  {labels.map(p=><div key={p.index} className={'terrain-marker terrain-marker-'+p.index+(p.index===index?' current':'')} style={{left:p.x+'%',top:p.y+'%'}}><i/><span>{LANDMARKS[p.index].name}{p.index===3&&<small>湖泊位置标记</small>}</span></div>)}
  <div className="terrain-tag">立体地形<span>真实高程 · 非实景复刻</span></div>
  <div className="terrain-camera"><button onClick={()=>setLookBack(false)} aria-pressed={!lookBack}>看向前方</button><button onClick={()=>setLookBack(true)} aria-pressed={lookBack}>回望来路</button></div>
  <p className="terrain-footnote">地表为高程设色；未复原实际植被、步道、建筑或湖岸。</p>
 </div>;
}
