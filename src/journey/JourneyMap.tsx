import { useEffect, useRef, useState } from 'react';
import { LANDMARKS } from './landmarks';
import { frameFor, fullFrame, positionAt, project, type JourneyState, type MapFrame } from './model';

export default function JourneyMap({state,focus,reduced,onSelect}:{state:JourneyState;focus:boolean;reduced:boolean;onSelect(index:number):void}){
 const [frame,setFrame]=useState<MapFrame>(fullFrame),current=useRef(frame);
 const mapRef=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:1200,height:650});
 useEffect(()=>{const element=mapRef.current!;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(element);return()=>observer.disconnect();},[]);
 const drawnWidth=Math.min(size.width,size.height*1200/650),drawnHeight=drawnWidth*650/1200;
 const labelPosition=(p:{x:number;y:number})=>({left:((size.width-drawnWidth)/2+p.x/1200*drawnWidth)/size.width*100+'%',top:((size.height-drawnHeight)/2+p.y/650*drawnHeight)/size.height*100+'%'});
 const [imageStatus,setImageStatus]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{
  const target=frameFor(state,focus),from=current.current;
  if(reduced){current.current=target;setFrame(target);return;}
  let id=0,start:number|null=null;
  const animate=(time:number)=>{start??=time;const t=Math.min(1,(time-start)/1300),e=t*t*(3-2*t);const f={x:from.x+(target.x-from.x)*e,y:from.y+(target.y-from.y)*e,width:from.width+(target.width-from.width)*e,height:from.height+(target.height-from.height)*e};current.current=f;setFrame(f);if(t<1)id=requestAnimationFrame(animate);};
  id=requestAnimationFrame(animate);return()=>cancelAnimationFrame(id);
 },[state.index,state.from,state.phase,focus,reduced]);
 const screen=(p:{x:number;y:number})=>({x:(p.x-frame.x)/frame.width*1200,y:(p.y-frame.y)/frame.height*650});
 const points=LANDMARKS.map(l=>project(l.coordinate));
 const line=points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
 const cursor=screen(project(positionAt(state)));
 const hasStarted=state.phase!=='overview';
 const scale=1200/frame.width;
 const mapKilometres=111.32*Math.cos(33.94*Math.PI/180)*.49;
 return <div ref={mapRef} className="atlas-map" data-map-frame={focus?'focused':'overview'}>
  <svg className="atlas-map-drawing" viewBox="0 0 1200 650" role="img" aria-label="鳌山至太白山区域高程地图；五处地点由叙事虚线连接，非实测轨迹">
   <defs><pattern id="map-grid" width="120" height="130" patternUnits="userSpaceOnUse"><path d="M120 0H0V130" fill="none" stroke="#425b4722" strokeWidth=".65"/></pattern></defs>
   <g transform={'scale('+scale+') translate('+(-frame.x)+' '+(-frame.y)+')'}>
    <image href="/journey/relief.png" width="1200" height="650" preserveAspectRatio="none" onLoad={()=>setImageStatus('ready')} onError={()=>setImageStatus('error')}/>
    <rect width="1200" height="650" fill="url(#map-grid)"/>
    <path d={line} fill="none" stroke="#faf2d8" strokeWidth="7" vectorEffect="non-scaling-stroke" opacity=".8"/>
    <path d={line} fill="none" stroke="#b45037" strokeWidth="2" strokeDasharray="5 6" vectorEffect="non-scaling-stroke"/>
    {points.slice(0,-1).map((p,i)=>state.visited.includes(i)&&state.visited.includes(i+1)?<path key={i} d={'M'+p.x+','+p.y+' L'+points[i+1].x+','+points[i+1].y} fill="none" stroke="#9b3a26" strokeWidth="3" vectorEffect="non-scaling-stroke"/>:null)}
    {state.phase==='travelling'&&<path d={'M'+points[state.from].x+','+points[state.from].y+' L'+project(positionAt(state)).x+','+project(positionAt(state)).y} fill="none" stroke="#9b3a26" strokeWidth="3" vectorEffect="non-scaling-stroke"/>}
   </g>
   {hasStarted&&<g transform={'translate('+cursor.x+' '+cursor.y+')'} data-testid="journey-position" data-longitude={positionAt(state).lon} data-latitude={positionAt(state).lat}><circle r="17" fill="#b5523726"/><circle r="8" fill="#b45037" stroke="#fffaec" strokeWidth="3"/></g>}
  </svg>
  {imageStatus!=='ready'&&<p className="map-status" role="status">{imageStatus==='loading'?'正在展开地形图…':'地形图加载失败；地名与导览仍可使用。'}{imageStatus==='error'&&<button onClick={()=>location.reload()}>重新加载</button>}</p>}
  <div className="map-region-name" aria-hidden="true">秦 岭<span>QINLING MOUNTAINS</span></div>
  {LANDMARKS.map((l,i)=>{
   const p=screen(points[i]);if(p.x<0||p.x>1200||p.y<30||p.y>620)return null;
   return <button key={l.id} className={'map-landmark map-landmark-'+i+(state.index===i&&hasStarted?' is-current':'')+(state.visited.includes(i)?' is-visited':'')} style={labelPosition(p)} onClick={()=>onSelect(i)} aria-label={'查看'+l.name} aria-pressed={state.index===i&&hasStarted}><span className={'map-pin'+(i===3?' lake-pin':'')}/><span className="map-label"><small>{String(i+1).padStart(2,'0')}</small><strong>{l.name}</strong><em>{l.elevation.toLocaleString()} m</em></span></button>;
  })}
  <div className="map-north" aria-label="地图上方为北">北<span>↑</span><small>N</small></div>
  <div className="map-scale"><span style={{width:(5/mapKilometres*scale*drawnWidth)+'px'}}/><small>5 公里 · 地图比例，非步行里程</small></div>
  <div className="map-key"><span><i/>导览连线</span><span><i/>已浏览相邻地点</span></div>
 </div>;
}
