/** 无声、离线、艺术化的天气编排。时间均是前台未暂停的体验秒数。 */
export type WeatherKind = 'clear' | 'cloudy' | 'mist';
export type WeatherChoice = 'auto' | WeatherKind;
export type WeatherWeights = [number, number, number];
export const WEATHER_LABELS: Record<WeatherKind, string> = { clear: '晴朗', cloudy: '多云', mist: '薄雾' };
export const WEATHER_CYCLE_SECONDS = 360;
export const WEATHER_TRANSITION_SECONDS = 12;
const PRESET: Record<WeatherKind, WeatherWeights> = { clear: [1,0,0], cloudy: [0,1,0], mist: [0,0,1] };
const smooth = (t: number) => { const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x); };
const mix = (a: WeatherWeights,b: WeatherWeights,t: number): WeatherWeights => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const STAGES: readonly [number,WeatherKind][] = [[0,'clear'],[30,'clear'],[100,'cloudy'],[140,'cloudy'],[220,'mist'],[260,'mist'],[360,'clear']];
export function autoWeatherAt(seconds: number) {
  const time=Number.isFinite(seconds)?((seconds%WEATHER_CYCLE_SECONDS)+WEATHER_CYCLE_SECONDS)%WEATHER_CYCLE_SECONDS:0;
  const end=STAGES.findIndex(([t])=>t>time),[start,from]=STAGES[end-1],[finish,to]=STAGES[end];
  const progress=(time-start)/(finish-start);
  return { weights:mix(PRESET[from],PRESET[to],smooth(progress)), from,to,progress,remaining:finish-time,transitioning:from!==to };
}
export function evaluateWeather(w: WeatherWeights) {
  const weighted=(clear:number,cloudy:number,mist:number)=>w[0]*clear+w[1]*cloudy+w[2]*mist;
  return {
    fog:weighted(.00024,.00042,.0015),sun:weighted(2.5,1.7,1.12),ambient:weighted(.95,1.04,1.10),
    coverage:weighted(.10,.78,.62),cloudShadow:weighted(.12,.54,.25),
    overcast:w[1]*.72+w[2]*.88,mist:w[2],
  };
}
export interface WeatherSnapshot {
  choice: WeatherChoice; weights: WeatherWeights; cycleTime: number; elapsed: number;
  parameters: ReturnType<typeof evaluateWeather>; current: WeatherKind; target: WeatherKind;
  transitioning: boolean; transitionProgress: number;
}
export class WeatherController {
  private choice: WeatherChoice;
  private weights: WeatherWeights;
  private cycleTime=0;
  private elapsed=0;
  private blendFrom: WeatherWeights | null=null;
  private blendTime=0;
  private wasRunning=false;
  constructor(choice: WeatherChoice='auto') { this.choice=choice;this.weights=[...PRESET[choice==='auto'?'clear':choice]]; }
  setChoice(choice: WeatherChoice) {
    if(choice===this.choice)return;
    this.blendFrom=[...this.weights];this.blendTime=0;this.choice=choice;
  }
  advance(delta: number,running: boolean) {
    // 恢复首帧丢弃 delta，卡顿帧只推进 100ms，绝不追赶后台时间。
    if(!running){this.wasRunning=false;return;}
    if(!this.wasRunning){this.wasRunning=true;return;}
    if(!Number.isFinite(delta)||delta<=0)return;
    const dt=Math.min(delta,.1);this.elapsed+=dt;
    if(this.choice==='auto')this.cycleTime=(this.cycleTime+dt)%WEATHER_CYCLE_SECONDS;
    const target=this.choice==='auto'?autoWeatherAt(this.cycleTime).weights:PRESET[this.choice];
    if(this.blendFrom){
      this.blendTime=Math.min(WEATHER_TRANSITION_SECONDS,this.blendTime+dt);
      if(this.blendTime>=WEATHER_TRANSITION_SECONDS-1e-8){this.weights=[...target];this.blendFrom=null;}
      else this.weights=mix(this.blendFrom,target,smooth(this.blendTime/WEATHER_TRANSITION_SECONDS));
    } else this.weights=[...target];
  }
  snapshot(): WeatherSnapshot {
    const auto=autoWeatherAt(this.cycleTime);
    const current=(['clear','cloudy','mist'] as const)[this.weights.indexOf(Math.max(...this.weights))];
    return { choice:this.choice,weights:[...this.weights],cycleTime:this.cycleTime,elapsed:this.elapsed,
      parameters:evaluateWeather(this.weights),current,target:this.choice==='auto'?auto.to:this.choice,
      transitioning:!!this.blendFrom||(this.choice==='auto'&&auto.transitioning),
      transitionProgress:this.blendFrom?this.blendTime/WEATHER_TRANSITION_SECONDS:this.choice==='auto'?auto.progress:1,
    };
  }
}
