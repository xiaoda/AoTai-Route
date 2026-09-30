import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS, type Settings } from './core/settings';
import type { Mode, Stats, Telemetry } from './scene/Experience';
import type { TravelMode } from './world/tour';
import { ROUTE, routeLength, VIEWPOINTS, routeMetrics, chapterAtDistance } from './world/route';
import MiniMap from './components/MiniMap';

const Experience = lazy(() => import('./scene/Experience'));
const EMPTY_STATS: Stats = { fps: 0, frameMs: 0, p95: 0, calls: 0, triangles: 0, distance: 0, height: 0, heading: 0, grounded: true, boundary: false, x: 0, y: 0, z: 0, renderer: '' };
const INITIAL_TELEMETRY: Telemetry = { ...ROUTE[0], y: 0, heading: 0, routeDistance: 0, routeOffset: 0, complete: false, altitude: 30 };
function MountainMark() {
  return <svg width="35" height="32" viewBox="0 0 42 34" fill="none" aria-hidden="true"><path d="M2 29 17 5l11 18 5-9 8 15M10 29l9-14 9 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Arrow() { return <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true"><path d="M1 9h18m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" /></svg>; }
function Gear() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-7 0v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>; }
function ViewpointButtons({onSelect,selected=-1,disabled=false,compact=false}:{onSelect(index:number):void;selected?:number;disabled?:boolean;compact?:boolean}){
 return <nav className={'node-picker'+(compact?' compact':'')} aria-label="观景节点">{VIEWPOINTS.map((p,i)=><button key={p.id} disabled={disabled} aria-pressed={selected===i} onClick={()=>onSelect(i)}><span className="node-number">0{i+1}</span><span>{compact?p.shortName:p.name}</span>{!compact&&<small>{(p.distance/1000).toFixed(2)} km ↗</small>}</button>)}</nav>;
}
class SceneBoundary extends Component<{ children: ReactNode; onError(message: string): void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError('三维场景未能启动。请刷新重试，或检查浏览器是否支持 WebGL2。'); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('intro');
  const [travel, setTravel] = useState<TravelMode>('air');
  const [cruising, setCruising] = useState(true);
  const [speed, setSpeed] = useState(6), [altitude, setAltitude] = useState(30);
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);
  const [recenterToken, setRecenterToken] = useState(0), [arrived, setArrived] = useState(false);
  const [replayToken, setReplayToken] = useState(0);
  const [viewpointToken,setViewpointToken]=useState(0),[viewpointIndex,setViewpointIndex]=useState(1);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stats, setStats] = useState(EMPTY_STATS), [showStats, setShowStats] = useState(false);
  const [locked, setLocked] = useState(false), [resetToken, setResetToken] = useState(0);
  const [notice, setNotice] = useState('');
  const modalRef = useRef<HTMLDialogElement>(null);
  const pause = useCallback(() => {
    setMode(m => m === 'walking' ? 'paused' : m);
    if (document.pointerLockElement) document.exitPointerLock();
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback((message: string) => { setError(message); setReady(false); setMode('paused'); }, []);
  const onComplete = useCallback(() => { setArrived(true); pause(); }, [pause]);
  const start = (nextTravel: TravelMode = travel) => {
    if (!ready || error) return;
    if (nextTravel !== travel) {
      setTravel(nextTravel); setArrived(false); if (nextTravel === 'air') setCruising(true);
      setNotice(nextTravel === 'air' ? '已切入半空，从最近的路径位置自动前进。' : '已回到此前保留的徒步位置。');
    } else if (arrived && nextTravel === 'air') {
      setReplayToken(t => t + 1); setArrived(false); setCruising(true);
    }
    setMode('walking');
    const canvas = document.querySelector('canvas');
    canvas?.focus();
    if (nextTravel === 'air') return;
    try {
      const result = canvas?.requestPointerLock();
      result?.catch(() => { setLocked(false); setNotice('鼠标未锁定：按住画面拖动，或使用方向键转头。'); });
    } catch { setLocked(false); setNotice('可按住画面拖动，或使用方向键转头。'); }
  };
  const openViewpoint=(next:TravelMode,index=1)=>{
    if(!ready||error)return;
    if(document.pointerLockElement)document.exitPointerLock();
    setTravel(next);setAltitude(30);setCruising(false);setArrived(false);setMode('walking');setViewpointIndex(index);setViewpointToken(t=>t+1);
    setNotice('已到 '+VIEWPOINTS[index].name+(next==='air'?'，当前位置驻足。继续前进将沿完整样段。':'。WASD 行走，拖动或方向键环顾。'));
    document.querySelector('canvas')?.focus();
  };
  const openSettings = () => { pause(); setSettingsOpen(true); };
  const updateSettings = (next: Settings) => {
    setSettings(next);
    if (!saveSettings(next)) setNotice('设置已应用，但浏览器无法保存；下次进入会恢复默认值。');
  };
  useEffect(() => {
    if (settingsOpen) modalRef.current?.showModal(); else modalRef.current?.close();
  }, [settingsOpen]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || settingsOpen) return;
      if (event.code === 'KeyP' && !event.repeat) setShowStats(s => !s);
      if (event.code === 'Escape' && mode === 'walking') pause();
      if (event.code === 'Space' && travel === 'air' && mode !== 'intro' && !event.repeat && !(event.target instanceof Element && event.target.closest('button'))) {
        event.preventDefault(); if (mode === 'walking') pause(); else start();
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [mode, pause, settingsOpen, travel, arrived, ready, error]);

  return <main className={`app mode-${mode} travel-${travel}`}>
    <div className="scene-layer">
      <SceneBoundary onError={onError}><Suspense fallback={<div className="scene-loading">正在准备山野…</div>}>
        <Experience viewpointIndex={viewpointIndex} viewpointToken={viewpointToken} mode={mode} settings={settings} resetToken={resetToken} replayToken={replayToken} travel={travel} cruising={cruising} speed={speed} altitude={altitude} recenterToken={recenterToken} onTelemetry={setTelemetry} onComplete={onComplete} onReady={onReady} onPause={pause} onError={onError} onStats={setStats} onInputMode={setLocked} />
      </Suspense></SceneBoundary>
    </div>
    <div className="scene-shade" aria-hidden="true" />
    <header className="topbar">
      <div className="brand"><MountainMark /><div><span className="brand-title">鳌太行旅</span><span className="brand-sub">AOTAI · FIELD NOTES</span></div></div>
      {mode === 'walking' && <div className="compass" aria-label={`虚拟场景朝向 ${Math.round(telemetry.heading)} 度`}><span>{['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(telemetry.heading / 45) % 8]}</span><i /><span className="heading">{Math.round(telemetry.heading).toString().padStart(3, '0')}°</span><i /><span>方位</span><b>⌃</b></div>}
      <div className="top-actions">
        <span className="prototype-label"><span className="live-dot" />阶段 02<span className="divider">/</span>连续样段 · 三处观景</span>
        <button className={`icon-button ${showStats ? 'selected' : ''}`} title="性能面板（P）" aria-label="切换性能面板" aria-pressed={showStats} onClick={() => setShowStats(!showStats)}><span className="bars">▂▅▇</span></button>
        <button className="icon-button" aria-label="体验设置" onClick={openSettings}><Gear /></button>
        {mode === 'walking' && <button className="icon-button pause-button" aria-label="暂停体验" onClick={pause}>Ⅱ</button>}
      </div>
    </header>

    {mode === 'intro' && !error && <section className="welcome" aria-labelledby="welcome-title">
      <div className="eyebrow"><span />把脚步，交还给山野</div>
      <h1 id="welcome-title">山在那里。<br /><span>慢慢走过去。</span></h1>
      <p className="welcome-description">离开屏幕里的喧闹，走进一段安静的山路。<br />不赶路，不闯关。此刻，只需要向前。</p>
      <div className="start-row"><button className="primary-button" onClick={() => {setResetToken(t=>t+1);setCruising(true);start('air');}} disabled={!ready}>{ready ? '漫游完整样段' : '正在准备场景'}{ready ? <Arrow /> : <span className="spinner" />}</button><button className="secondary-button" onClick={() => openViewpoint('foot',1)} disabled={!ready}>石河近景<span>↗</span></button></div>
      <p className="start-caption">{(routeLength/1000).toFixed(2)} 公里连续样段 · 3 处观景节点</p><button className="text-button original-route" disabled={!ready} onClick={()=>openViewpoint('air',1)}>鸟瞰已验收的石河视点 ↗</button>
      <div className="prototype-note"><span className="outline-badge">样段说明</span><p>太白山高山区 · 真实高程打底，岩石与草甸艺术重建。<br />虚拟路径非实地路线；本阶段暂无声音与动态天气。</p></div>
    </section>}

    {mode === 'intro' && !error && <aside className="field-card" aria-label="本次体验说明">
      <span className="eyebrow">山野手记 / 002</span>
      <div className="field-route-facts"><strong>{(routeLength/1000).toFixed(2)}<small>公里 · 水平路径</small></strong><span>↑ {routeMetrics.ascent.toFixed(0)} m　↓ {routeMetrics.descent.toFixed(0)} m</span></div>
      <div className="field-card-title"><h2>沿着山脊<br />看三重山色</h2><span>↗</span></div>
      <p>走过风脊草坡与石河，<br />再看谷地和群峰的距离。</p>
      <div className="field-data"><span>太白山高山区</span><strong>石海 · 草甸 · 远山</strong><a href="/terrain-sources.txt" target="_blank" rel="noreferrer">高程来源与重建边界 ↗</a></div>
      <ViewpointButtons disabled={!ready} onSelect={i=>openViewpoint('air',i)}/>
      <div className="field-card-foot"><span>点击节点驻足 · 虚拟路径，非导航</span><span>↗</span></div>
    </aside>}

    {mode === 'intro' && !error && <footer className="intro-footer">
      <div className="control-guide"><span><kbd>W A S D</kbd> 移动</span><span><span className="mouse-icon" />鼠标转头</span><span><kbd>ESC</kbd> 暂停</span></div>
      <span className="footer-note">数字山野体验 · 请勿用于现实穿越导航</span>
    </footer>}

    {mode === 'walking' && <>
      <div className="landscape-caption"><span className="eyebrow">太白山 / 连续高山样段</span><strong>{chapterAtDistance(telemetry.routeDistance).name}</strong><span>真实高程 · 近景艺术重建</span><p className="node-description">{chapterAtDistance(telemetry.routeDistance).description}</p><ViewpointButtons compact selected={VIEWPOINTS.findIndex(p=>Math.abs(p.distance-telemetry.routeDistance)<40)} onSelect={i=>openViewpoint(travel,i)}/><div className="viewpoint-actions compact"><button onClick={()=>openViewpoint('air',VIEWPOINTS.indexOf(chapterAtDistance(telemetry.routeDistance)))}>鸟瞰此节点</button><button onClick={()=>openViewpoint('foot',VIEWPOINTS.indexOf(chapterAtDistance(telemetry.routeDistance)))}>徒步此节点</button></div></div>
      {travel === 'foot' && <div className="crosshair" aria-hidden="true" />}
      <div className="walking-bottom"><div className="journey-status"><span className="eyebrow">{travel === 'air' ? '让山路，带你向前' : '沿着自己的节奏'}</span><div><strong>{telemetry.distance.toFixed(0)}</strong><span>米 · {travel === 'air' ? '路径位置' : '本次步行'}</span></div><span className="terrain-label">{travel === 'air' ? `${cruising ? `自动前进 ${speed} 米/秒` : '驻足看景 · 位置保持'} · 离地约 ${telemetry.altitude.toFixed(0)} 米` : '真实高程 · 近景艺术重建'}</span></div>
        <div className="walking-help">{travel === 'foot' && <span><kbd>W A S D</kbd>移动 <kbd>SHIFT</kbd> 慢行</span>}<span>{locked ? '移动鼠标环顾四周' : '按住画面拖动 / 方向键转头'}<span className="divider">·</span><kbd>{travel === 'air' ? 'SPACE' : 'ESC'}</kbd> 暂停</span></div>
      </div>
      {travel === 'air' && <section className="tour-controls" aria-label="半空漫游控制">
        <div className="tour-control-row"><span className="tour-label">前进速度</span><div className="speed-options" role="group" aria-label="漫游速度">{[3, 6, 12].map(s => <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s === 3 ? '舒缓' : s === 6 ? '标准' : '快速'}<small>{s} 米/秒</small></button>)}</div></div>
        <div className="tour-control-row tour-secondary"><label htmlFor="tour-altitude">视角高度</label><select id="tour-altitude" value={altitude} onChange={e => setAltitude(Number(e.target.value))}><option value="10">低空 · 10 米</option><option value="30">鸟瞰 · 30 米</option></select><button onClick={() => setRecenterToken(t => t + 1)}>视角回正</button><button onClick={pause} aria-label="暂停漫游">Ⅱ 暂停</button></div>
        <button className="tour-hold" aria-pressed={!cruising} onClick={() => setCruising(v => !v)}>{cruising ? '◇ 驻足看景' : '▷ 继续前进'}<span>{cruising ? '保持当前位置，不遮挡山景' : '已停留，可拖动画面环顾'}</span></button>
      </section>}
      {stats.boundary && <div className="toast">已到达可行走样段边界，请转身继续探索。</div>}
    </>}

    {mode !== 'intro' && !error && <MiniMap telemetry={telemetry} travel={travel} />}

    {mode === 'paused' && !settingsOpen && !error && <section className="pause-overlay" aria-labelledby="pause-title">
      <div className="pause-panel"><span className="eyebrow">{arrived ? '这段山路，已看过' : '给旅程一点留白'}</span><h1 id="pause-title">{arrived ? '已到达样段终点。' : '在这里，歇一会。'}</h1><p>{arrived ? '可以换个速度重游，或回到地面慢慢走。' : '山还在那里，旅程可以慢慢继续。'}</p>
        <button className="primary-button" onClick={() => start()} disabled={!ready}>{arrived ? '重新漫游' : travel === 'air' ? (cruising ? '继续漫游' : '返回驻足观景') : '继续行走'}<Arrow /></button>
        <div className="travel-switch"><button className="text-button" onClick={() => start(travel === 'air' ? 'foot' : 'air')}>{travel === 'air' ? '切换自由徒步' : '切换半空漫游'} ↗</button><small>{travel === 'air' ? '返回此前保留的徒步位置' : '从最近的路径点自动向前'}</small></div>
        <div className="pause-links"><button onClick={openSettings}>体验设置</button><button onClick={() => { setResetToken(t => t + 1); setArrived(false); setCruising(true); setNotice('已回到高山样段起点。'); }}>回到起点</button><button onClick={() => { setResetToken(t => t + 1); setArrived(false); setCruising(true); setMode('intro'); }}>返回首页</button></div>
        <span className="pause-note">暂离窗口会自动暂停 · 本阶段不保存旅程进度</span>
      </div>
    </section>}

    {showStats && <aside className="stats-panel" aria-label="性能面板"><div className="stats-title"><span>运行观测</span><span>实时 / 0.5s</span></div>
      <div className="fps"><strong>{stats.fps || '—'}</strong><span>FPS</span></div>
      <dl><div><dt>平均帧时间</dt><dd>{stats.frameMs.toFixed(1)} ms</dd></div><div><dt>P95 · 最近窗口</dt><dd>{stats.p95.toFixed(1)} ms</dd></div><div><dt>绘制调用 / 三角形</dt><dd>{stats.calls} / {(stats.triangles / 1000).toFixed(1)}k</dd></div><div><dt>视角状态</dt><dd>{travel === 'air' ? '半空漫游' : stats.grounded ? '已接地' : '落地中'}</dd></div><div><dt>画质 / 内部像素比</dt><dd>{settings.quality === 'eco' ? '节能 / 0.75' : '均衡 / 1.0'}</dd></div><div><dt>局部坐标 X / Z</dt><dd>{stats.x.toFixed(1)} / {stats.z.toFixed(1)}</dd></div></dl>
      <p>当前浏览器实测，不代表所有普通电脑。<br />局部米制坐标；高程非实地导航依据。</p>
    </aside>}

    {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    {error && <section className="error-overlay" role="alert"><span className="eyebrow">场景暂时无法继续</span><h1>先停一下。</h1><p>{error}</p><button className="primary-button" onClick={() => location.reload()}>重新加载<Arrow /></button></section>}

    <dialog ref={modalRef} className="settings-dialog" onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} aria-labelledby="settings-title">
      <div className="dialog-heading"><div><span className="eyebrow">让这段路更舒服</span><h2 id="settings-title">体验设置</h2></div><button className="icon-button" aria-label="关闭设置" onClick={() => setSettingsOpen(false)}>×</button></div>
      <label className="setting-row" htmlFor="sensitivity"><span>视角灵敏度</span><output>{settings.sensitivity.toFixed(1)}×</output></label><input id="sensitivity" type="range" min="0.3" max="2" step="0.1" value={settings.sensitivity} onChange={e => updateSettings({ ...settings, sensitivity: Number(e.target.value) })} />
      <label className="setting-row" htmlFor="fov"><span>视野角度</span><output>{settings.fov}°</output></label><input id="fov" type="range" min="55" max="90" step="1" value={settings.fov} onChange={e => updateSettings({ ...settings, fov: Number(e.target.value) })} />
      <div className="setting-block"><label className="setting-row" htmlFor="quality"><span>画质档位</span></label><select id="quality" value={settings.quality} onChange={e => updateSettings({ ...settings, quality: e.target.value as Settings['quality'] })}><option value="balanced">均衡 · 清晰度优先</option><option value="eco">节能 · 降低渲染负担</option></select><p>卡顿时选择节能。两档使用相同地形与碰撞。</p></div>
      <label className="toggle-row"><span>轻微行走晃动<small>默认关闭，减少眩晕感</small></span><input type="checkbox" role="switch" checked={settings.bob} onChange={e => updateSettings({ ...settings, bob: e.target.checked })} /></label>
      <div className="settings-foot"><button className="text-button" onClick={() => updateSettings({ ...DEFAULT_SETTINGS })}>恢复默认</button><button className="primary-button small" onClick={() => setSettingsOpen(false)}>完成<Arrow /></button></div>
      <p className="local-note">设置仅保存在本机 · 无需登录 · 当前版本暂无音频</p>
    </dialog>
  </main>;
}
