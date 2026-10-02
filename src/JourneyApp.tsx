import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { JOURNEY_NOTICE, LANDMARKS } from './journey/landmarks';
import { initialJourney, nextLeg, previousStop, selectStop, startJourney } from './journey/model';
import { useJourney, useReducedMotion } from './journey/useJourney';
import JourneyMap from './journey/JourneyMap';
import './journey/journey.css';
const TerrainView=lazy(()=>import('./journey/TerrainView'));
const LandscapeExperience=lazy(()=>import('./App'));
function MountainIcon(){return <svg width="36" height="30" viewBox="0 0 40 32" fill="none" aria-hidden="true"><path d="M2 28 16 5l14 23M9 17l7 5 5-6M24 18l6-9 9 19" stroke="currentColor" strokeWidth="1.5"/></svg>;}
class ViewBoundary extends Component<{children:ReactNode;onReturn():void},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="terrain-message" role="alert">三维视图暂时无法显示。<button onClick={this.props.onReturn}>返回地理地图</button></div>:this.props.children;}
}
export default function JourneyApp(){
 const {state,setState,speed,setSpeed}=useJourney();
 const reduced=useReducedMotion();
 const [surface,setSurface]=useState<'map'|'terrain'|'sandbox'>('map');
 const [focus,setFocus]=useState(false),[sourcesOpen,setSourcesOpen]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null);
 const chapter=LANDMARKS[state.index],overview=state.phase==='overview',complete=state.phase==='complete',travelling=state.phase==='travelling';
 const next=LANDMARKS[state.index+1];
 const pause=()=>setState(s=>({...s,playing:false}));
 const choose=(index:number)=>{setState(s=>selectStop(s,index));setFocus(!reduced);};
 const go=()=>{
  if(overview||complete){setState(startJourney(!reduced));setFocus(!reduced);setSurface('map');return;}
  if(state.playing){pause();return;}
  if(reduced&&state.phase==='arrived'&&next){choose(state.index+1);return;}
  if(travelling){setState(s=>({...s,playing:true}));return;}
  setSurface('map');setState(s=>nextLeg({...s,continuous:!reduced}));
 };
 const changeSurface=(nextSurface:'map'|'terrain'|'sandbox')=>{pause();if(overview&&nextSurface==='terrain')setState(startJourney());setSurface(nextSurface);};
 useEffect(()=>{if(sourcesOpen)dialogRef.current?.showModal();else dialogRef.current?.close();},[sourcesOpen]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(sourcesOpen||surface==='sandbox')return;if(e.code==='Escape'){setState(s=>({...s,playing:false}));setSurface('map');return;}if(e.code==='Space'&&!(e.target instanceof Element&&e.target.closest('button,a,input,select,textarea,summary'))){e.preventDefault();go();}};
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 });
 const openSources=()=>{pause();setSourcesOpen(true);};
 if(surface==='sandbox')return <div className="legacy-shell"><div className="legacy-returnbar"><button onClick={()=>setSurface('map')}>← 返回鳌太地理导览</button><span>辅助体验 · 2.23 公里虚拟地貌样段，不是鳌太全线</span></div><ViewBoundary onReturn={()=>setSurface('map')}><Suspense fallback={<div className="terrain-message">正在准备地貌样段…</div>}><LandscapeExperience/></Suspense></ViewBoundary></div>;
 return <main className="journey-app">
  <header className="journey-header">
   <button className="journey-brand" aria-label="返回鳌太全貌" onClick={()=>{setState(initialJourney);setSurface('map');setFocus(false);}}><MountainIcon/><span>鳌太行旅<small>AOTAI · A GEOGRAPHIC JOURNEY</small></span></button>
   <nav aria-label="体验模式"><span className="journey-nav-current">地理导览</span><button onClick={()=>changeSurface('sandbox')}>地貌漫游 <span>↗</span></button></nav>
   <button className="journey-source-link" onClick={openSources}>资料与真实性 <span>↗</span></button>
  </header>
  <div className="journey-layout">
   <section className="journey-story" aria-label="当前导览章节">
    <div className="journey-kicker"><span/>秦岭 · 鳌山—太白山</div>
    <div className="story-copy" key={overview?'overview':complete?'complete':state.index}>
     <p className="chapter-overline">{overview?'一段主脊，五个地理锚点':complete?'把刚才的地点，连成来路':String(state.index+1).padStart(2,'0')+' / 05　'+chapter.kind}</p>
     <h1>{overview?<>从鳌山，<br/>到太白。</>:complete?<>山有了名字，<br/>路有了来处。</>:chapter.title.split('\n').map((line,i)=><span key={i}>{line}<br/></span>)}</h1>
     <p className="story-description">{overview?'先在地图上看懂两座山的联系，再跟随导览认识沿途地点。让山名、山形与来路，一次次对上。':complete?'这不是现实穿越的记录，而是一次对鳌太地理关系的认识。你可以重看任何一站，也可以回到山中观察地形。':chapter.body}</p>
    </div>
    {overview?<div className="journey-facts"><div><strong>西 → 东</strong><span>鳌山至太白山</span></div><div><strong>05 <small>处</small></strong><span>精选地理锚点</span></div></div>:complete?<div className="journey-recap"><span>本次已浏览 {state.visited.length} / 5 处</span><p>{state.visited.map(i=>LANDMARKS[i].name).join(' · ')}</p></div>:<div className="chapter-context"><div><span>{travelling?'正在前往':'此刻，认识这里'}</span><strong>{chapter.name}</strong></div><div><span>资料海拔 · 约</span><strong>{chapter.elevation.toLocaleString()}<small> m</small></strong></div></div>}
    {!overview&&!complete&&<div className="journey-look"><span>看什么</span><p>{chapter.look}</p></div>}
    <div className="journey-story-actions"><button className="journey-primary" onClick={go}>{overview?'开始地理导览':complete?'重新看一遍':state.playing?'暂停导览':travelling?'继续转场':next?'前往'+next.name:'完成并回顾'}<span>{state.playing?'Ⅱ':'→'}</span></button>
    {overview?<p className="journey-action-note">约 2 分钟 · 抵达后停留 · 全程无声</p>:<div className="journey-transport"><button disabled={state.index===0&&!travelling} onClick={()=>{setState(s=>previousStop(s));setFocus(!reduced);}}>← 上一站</button><button onClick={()=>{if(next||travelling)choose(travelling?state.index:state.index+1);else setState(s=>({...s,phase:'complete',playing:false}));}}>{travelling?'直接抵达':next?'下一站 →':'回顾全程 ↗'}</button><label><span className="sr-only">导览播放速度</span><select value={speed} onChange={e=>setSpeed(Number(e.target.value))} aria-label="导览播放速度"><option value={1}>1× 播放</option><option value={2}>2× 播放</option></select></label></div>}
    </div>
    <div className="journey-truth"><i>i</i><p>数字地理展览，不用于现实穿越导航。<br/>{overview?'地名有据，连线示意；未复刻完整实地线路。':reduced?'已遵循减弱动态偏好，支持逐站浏览。':'切出窗口自动暂停，返回后由你继续。'}</p></div>
   </section>
   <section className="journey-atlas" aria-label="鳌太地理地图与立体观察">
    <div className="atlas-heading"><div><span className="atlas-sheet-number">图 01</span><h2>{surface==='terrain'?chapter.name+' · 立体地形':focus&&!overview&&!complete?'当前路段':'鳌太主脊 · 地理全貌'}</h2></div><div className="atlas-view-switch" role="group" aria-label="地图显示模式"><button aria-pressed={surface==='map'} onClick={()=>changeSurface('map')}>地理地图</button><button aria-pressed={surface==='terrain'} onClick={()=>changeSurface('terrain')}>立体地形</button></div></div>
    <div className="atlas-stage">
     {surface==='map'?<JourneyMap state={state} focus={focus} reduced={reduced} onSelect={choose}/>:<ViewBoundary key={state.index} onReturn={()=>setSurface('map')}><Suspense fallback={<div className="terrain-message">正在准备立体视图…</div>}><TerrainView index={state.index} reduced={reduced}/></Suspense></ViewBoundary>}
     {surface==='map'&&<div className="atlas-tools"><button onClick={()=>{if(overview||complete)choose(state.index);else setFocus(f=>!f);}} aria-pressed={focus&&!overview&&!complete}>{focus&&!overview&&!complete?'↗ 看全貌':overview?'⊙ 聚焦鳌山':'⊙ 聚焦当前段'}</button></div>}
    </div>
    <div className="atlas-caption"><span><i className="caption-dot"/>{overview?'从西端鳌山出发，向东认识太白山':complete?'回到全貌，回望来路':travelling?LANDMARKS[state.from].name+' → '+chapter.name:chapter.name+' · 已抵达导览节点'}</span><span>真实高程 · 原创设色</span></div>
    <div className="journey-bridge" aria-live="polite" aria-atomic="true"><span>{travelling?'地图转场':overview?'如何看这张图':complete?'导览回顾':'下一段'}</span><p>{travelling?LANDMARKS[state.from].transition:overview?JOURNEY_NOTICE:complete?'实线连接已浏览的相邻地点，未看的章节仍可点选。完整地理关系，不等于完整实地线路。':chapter.transition}</p>{travelling&&<div className="leg-progress" aria-hidden="true"><i style={{width:state.progress*100+'%'}}/></div>}</div>
   </section>
  </div>
  <section className="journey-chapters" aria-label="五处地理锚点"><div className="chapter-rail-label"><span>沿着主脊</span><strong>西 <span>────────</span> 东</strong></div><nav aria-label="选择地理章节">{LANDMARKS.map((p,i)=><button key={p.id} className={(state.index===i&&!overview?' active':'')+(state.visited.includes(i)?' visited':'')} aria-current={state.index===i&&!overview?'step':undefined} onClick={()=>choose(i)}><span className="station-index">{state.visited.includes(i)?'✓':String(i+1).padStart(2,'0')}</span><span className="station-name"><strong>{p.name}</strong><small>{p.english}</small></span><span className="station-state">{state.index===i&&!overview?travelling?'前往中':'当前':state.visited.includes(i)?'已浏览':'待认识'}</span></button>)}</nav></section>
  <footer className="journey-footer"><span>仅展现精选地点的地理关系 · 中间路段有省略 · 不提供通行指引</span><button onClick={openSources}>地形：Mapzen / USGS　·　地名与点位来源 ↗</button></footer>
  <dialog ref={dialogRef} className="journey-dialog" onCancel={()=>setSourcesOpen(false)} onClose={()=>setSourcesOpen(false)} aria-labelledby="journey-sources-title">
   <div className="journey-dialog-header"><div><span>关于这次数字旅程</span><h2 id="journey-sources-title">哪些是真实资料，哪些是表达？</h2></div><button onClick={()=>setSourcesOpen(false)} aria-label="关闭资料说明">×</button></div>
   <div className="journey-evidence"><article><strong>01 · 地形有来源</strong><p>区域地形来自 Mapzen Terrain Tiles 中的 USGS SRTM 高程。本图为原创晕渲与设色，不是卫星照片。区域三维网格约 95 米，不夸大垂直尺度；不能用于精密测量。</p><a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Terrain Tiles 数据说明 ↗</a></article><article><strong>02 · 连线是叙事，不是轨迹</strong><p>{JOURNEY_NOTICE}本版不包含进出山路线；中间路段有省略。大爷海与拔仙台按展览叙事安排先后，不声称是唯一穿越顺序。播放时长不是现实行程用时。</p></article><article><strong>03 · 三维不冒充实景</strong><p>立体地形只还原 DEM 山体起伏，不复原湖岸、建筑、植被或步道。原 2.23 公里石河样段保留为“地貌漫游”，不会套用真实地标名称。公开社区点位也不是实测控制点。</p></article></div>
   <h3>地点资料</h3><div className="source-list">{LANDMARKS.map(p=><article key={p.id}><strong>{p.name}</strong><p>{p.coordinateNote}</p><div>{p.sources.map(s=><a href={s.url} target="_blank" rel="noreferrer" key={s.url}>{s.label} ↗</a>)}</div></article>)}</div>
   <p className="source-license">大爷海点位来源于 OpenStreetMap contributors，经 Mapcarta 核对；该点位数据遵循 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">ODbL</a>，独立数据与署名见 <a href="/journey/sources.txt" target="_blank" rel="noreferrer">本地来源说明</a>。本产品用于地理认识与自然保护教育，不提供实地穿越指引。</p>
  </dialog>
 </main>;
}
