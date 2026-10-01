import { describe, expect, test } from 'vitest';
import { WeatherController, WEATHER_CYCLE_SECONDS, WEATHER_TRANSITION_SECONDS, autoWeatherAt, evaluateWeather, type WeatherChoice } from './weather';

function advance(w: WeatherController, seconds: number, fps=60) {
  w.advance(0, true);
  for (let i=0;i<Math.round(seconds*fps);i++) w.advance(1/fps,true);
  return w.snapshot();
}
describe('天气编排',()=>{
  test('初始晴朗保留已验收光照与雾，三类具有不同可见度',()=>{
    const w=new WeatherController();expect(w.snapshot().choice).toBe('auto');
    const p=w.snapshot().parameters;expect(p.sun).toBe(2.5);expect(p.fog).toBe(.00024);expect(p.ambient).toBe(.95);
    expect(evaluateWeather([0,1,0]).fog).toBeGreaterThan(p.fog);
    expect(evaluateWeather([0,0,1]).fog).toBeGreaterThan(evaluateWeather([0,1,0]).fog);
  });
  test('六分钟循环连续，权重非负且和为一',()=>{
    expect(WEATHER_CYCLE_SECONDS).toBe(360);
    for(let t=-1;t<=721;t+=.37){const a=autoWeatherAt(t);expect(a.weights.reduce((x,y)=>x+y,0)).toBeCloseTo(1,10);expect(a.weights.every(x=>x>=0&&x<=1)).toBe(true);}
    for(const t of [0,30,100,140,220,260,360]){
      const a=autoWeatherAt(t-.0001).weights,b=autoWeatherAt(t+.0001).weights;
      expect(Math.max(...a.map((x,i)=>Math.abs(x-b[i])))).toBeLessThan(.00001);
    }
    expect(autoWeatherAt(110).weights).toEqual([0,1,0]);expect(autoWeatherAt(230).weights).toEqual([0,0,1]);
    expect(autoWeatherAt(360).weights).toEqual([1,0,0]);
  });
  test('手动 12 秒渐变，中途反选从当前画面继续',()=>{
    const w=new WeatherController('clear');w.setChoice('mist');
    expect(w.snapshot().weights).toEqual([1,0,0]);advance(w,6);
    expect(w.snapshot().weights[2]).toBeCloseTo(.5,6);
    const before=w.snapshot().weights;w.setChoice('cloudy');expect(w.snapshot().weights).toEqual(before);
    advance(w,WEATHER_TRANSITION_SECONDS);expect(w.snapshot().weights[1]).toBeCloseTo(1,8);
    expect(w.snapshot().transitioning).toBe(false);
  });
  test('固定天气冻结自动相位但云继续运动，回自动平滑衔接',()=>{
    const w=new WeatherController();advance(w,50);const phase=w.snapshot().cycleTime;
    w.setChoice('mist');advance(w,15);expect(w.snapshot().cycleTime).toBe(phase);expect(w.snapshot().elapsed).toBeGreaterThan(50);
    const before=w.snapshot().weights;w.setChoice('auto');expect(w.snapshot().weights).toEqual(before);
    advance(w,12);const s=w.snapshot();s.weights.forEach((v,i)=>expect(v).toBeCloseTo(autoWeatherAt(s.cycleTime).weights[i],7));
  });
  test('暂停所有时钟与参数，恢复首帧不追赶后台时间',()=>{
    const w=new WeatherController();advance(w,60);const before=w.snapshot();
    for(let i=0;i<20;i++)w.advance(10,false);expect(w.snapshot()).toEqual(before);
    w.advance(200,true);expect(w.snapshot()).toEqual(before);w.advance(.05,true);expect(w.snapshot().elapsed-before.elapsed).toBeCloseTo(.05);
  });
  test('暂停中选择不改画面，恢复后才渐变',()=>{
    const w=new WeatherController('clear');advance(w,1);w.advance(.1,false);w.setChoice('mist');const before=w.snapshot().weights;
    w.advance(10,false);expect(w.snapshot().weights).toEqual(before);advance(w,12);expect(w.snapshot().weights[2]).toBeCloseTo(1,8);
  });
  test('非法和过大时间增量安全，合法帧率下与帧率无关',()=>{
    const w=new WeatherController();w.advance(0,true);for(const d of [NaN,Infinity,-3])w.advance(d,true);expect(w.snapshot().elapsed).toBe(0);
    w.advance(60,true);expect(w.snapshot().elapsed).toBe(.1);
    const a=new WeatherController(),b=new WeatherController();advance(a,83,30);advance(b,83,120);
    a.snapshot().weights.forEach((v,i)=>expect(v).toBeCloseTo(b.snapshot().weights[i],8));
  });
  test('所有固定预设可初始化，重复选择不重启渐变，快照不可修改控制器',()=>{
    for(const choice of ['clear','cloudy','mist'] as WeatherChoice[]){const w=new WeatherController(choice);expect(w.snapshot().choice).toBe(choice);}
    const w=new WeatherController('clear');w.setChoice('mist');advance(w,6);w.setChoice('mist');advance(w,6);expect(w.snapshot().weights[2]).toBeCloseTo(1,8);
    const s=w.snapshot();s.weights[0]=99;expect(w.snapshot().weights[0]).not.toBe(99);
  });
});
