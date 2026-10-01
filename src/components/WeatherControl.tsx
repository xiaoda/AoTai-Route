import { useEffect, useRef } from 'react';
import { WEATHER_LABELS, type WeatherChoice } from '../world/weather';
import type { WeatherReport } from '../scene/Weather';

interface Props { choice:WeatherChoice; report:WeatherReport; disabled?:boolean; onChange(choice:WeatherChoice):void }
function WeatherMark(){return <svg viewBox="0 0 38 28" fill="none" aria-hidden="true"><circle cx="12" cy="10" r="5" stroke="currentColor"/><path d="M12 1v2M3 10H1M5 3l2 2M20 3l-2 2M8 23h21a5 5 0 0 0 0-10 8 8 0 0 0-15-2 6 6 0 0 0-6 12Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>;}
export default function WeatherControl({choice,report,disabled=false,onChange}:Props){
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{
    const outside=(e:PointerEvent)=>{if(ref.current?.open&&e.target instanceof Node&&!ref.current.contains(e.target))ref.current.open=false;};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[]);
  const close=()=>{if(ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus();}};
  return <details className="weather-control" ref={ref} onKeyDown={e=>{if(e.key==='Escape'&&ref.current?.open){e.preventDefault();e.stopPropagation();close();}}}>
    <summary aria-label={'天气控制：'+(choice==='auto'?'自动变化':'固定天气')+'，当前'+WEATHER_LABELS[report.current]}>
      <WeatherMark/><span><small>{choice==='auto'?'自动天气':'固定天气'}</small><strong>{WEATHER_LABELS[report.current]}{report.transitioning&&<i>渐变中</i>}</strong></span><b aria-hidden="true">⌄</b>
    </summary>
    <div className="weather-sheet">
      <div className="weather-heading"><span className="eyebrow">山间天气 / 003</span><button aria-label="收起天气控制" onClick={close}>×</button></div>
      <h2>云过山脊</h2><p className="weather-intro">等一阵云，让远山换个模样。</p>
      <label htmlFor="weather-choice">天气模式</label>
      <select id="weather-choice" value={choice} disabled={disabled} onChange={e=>onChange(e.target.value as WeatherChoice)}>
        <option value="auto">自动变化 · 晴 / 云 / 雾</option><option value="clear">固定 · 晴朗</option><option value="cloudy">固定 · 多云</option><option value="mist">固定 · 薄雾</option>
      </select>
      <div className="weather-sequence" aria-hidden="true">{(['clear','cloudy','mist'] as const).map((kind,i)=><span key={kind} style={{opacity:.4+report.weights[i]*.6}}><i style={{transform:'scaleX('+(.05+report.weights[i]*.95)+')'}}/>{WEATHER_LABELS[kind]}</span>)}</div>
      <p className="weather-state">{!report.running?'天气已暂停，继续体验后变化。':report.transitioning?'正在缓缓转向'+WEATHER_LABELS[report.target]+'。':choice==='auto'?'此刻'+WEATHER_LABELS[report.current]+'，云层缓缓移动。':'已保持'+WEATHER_LABELS[report.current]+'，云层仍缓缓移动。'}</p>
      <div className="weather-notes"><span>自动约 6 分钟一轮 · 手动约 12 秒渐变</span><span>暂停与暂离窗口时，天气一同停留。</span><span>离线艺术编排 · 非实时天气 · 无声音</span></div>
    </div>
  </details>;
}
