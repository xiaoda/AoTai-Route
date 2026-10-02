import { describe, it, expect } from 'vitest';
import { initialJourney, startJourney, nextLeg, tickJourney, selectStop, previousStop, positionAt, project, unproject, frameFor } from './model';
import { LANDMARKS, MAP_BOUNDS } from './landmarks';
describe('地理导览状态',()=>{
 it('开场是总览，启程先认识鳌山',()=>{expect(initialJourney.phase).toBe('overview');expect(startJourney().index).toBe(0);expect(startJourney().phase).toBe('arrived');});
 it('前往下一站有转场且抵达后驻足',()=>{let s=nextLeg(startJourney());expect(s.phase).toBe('travelling');expect(s.from).toBe(0);expect(s.index).toBe(1);for(let i=0;i<200;i++)s=tickJourney(s,.1);expect(s.phase).toBe('arrived');expect(s.playing).toBe(false);expect(s.visited).toEqual([0,1]);});
 it('暂停不推进；非法时间不推进；一帧不追赶后台时间',()=>{const s=nextLeg(startJourney());expect(tickJourney({...s,playing:false},2).progress).toBe(0);expect(tickJourney(s,NaN)).toEqual(s);expect(tickJourney(s,-1)).toEqual(s);expect(tickJourney(s,100).progress).toBeLessThan(.02);});
 it('选择节点不虚构浏览过中间地点，也不误报完成',()=>{const s=selectStop(startJourney(),4);expect(s.visited).toEqual([0,4]);expect(s.phase).toBe('arrived');expect(nextLeg(s).phase).toBe('complete');expect(selectStop(s,999)).toEqual(s);});
 it('回顾与重播边界',()=>{expect(previousStop(startJourney()).index).toBe(0);expect(previousStop(selectStop(startJourney(),3)).index).toBe(2);expect(startJourney().visited).toEqual([0]);});
 it('连接动画端点对应同一份地理坐标',()=>{const s=nextLeg(startJourney());expect(positionAt(s)).toEqual(LANDMARKS[0].coordinate);expect(positionAt({...s,progress:1})).toEqual(LANDMARKS[1].coordinate);});
});
describe('地图与资料边界',()=>{
 it('重要地点顺序及来源明确',()=>{expect(LANDMARKS.map(p=>p.name)).toEqual(['鳌山','麦秸岭','太白梁','大爷海','拔仙台']);for(const p of LANDMARKS){expect(p.sources.length).toBeGreaterThan(0);expect(p.coordinate.lon).toBeGreaterThan(MAP_BOUNDS.west);expect(p.coordinate.lon).toBeLessThan(MAP_BOUNDS.east);expect(p.coordinate.lat).toBeGreaterThan(MAP_BOUNDS.south);expect(p.coordinate.lat).toBeLessThan(MAP_BOUNDS.north);}});
 it('投影往返、正北及东西方向一致',()=>{for(const p of LANDMARKS){const back=unproject(project(p.coordinate));expect(back.lon).toBeCloseTo(p.coordinate.lon,7);expect(back.lat).toBeCloseTo(p.coordinate.lat,7);}expect(project(LANDMARKS[0].coordinate).x).toBeLessThan(project(LANDMARKS[4].coordinate).x);});
 it('任意选点的镜头范围在图内且包含目标',()=>{for(let i=0;i<LANDMARKS.length;i++){const f=frameFor(selectStop(startJourney(),i),true);const p=project(LANDMARKS[i].coordinate);expect(p.x).toBeGreaterThanOrEqual(f.x);expect(p.x).toBeLessThanOrEqual(f.x+f.width);expect(p.y).toBeGreaterThanOrEqual(f.y);expect(p.y).toBeLessThanOrEqual(f.y+f.height);expect(f.x).toBeGreaterThanOrEqual(0);expect(f.y).toBeGreaterThanOrEqual(0);expect(f.x+f.width).toBeLessThanOrEqual(1200.001);}});
});

describe('连续导览与回顾完整性',()=>{
 it('自动导览依次抵达五站并收束，而非永远循环',()=>{let s=startJourney(true);const arrived:number[]=[0];for(let i=0;i<1200;i++){const before=s;s=tickJourney(s,.1);if(before.phase==='travelling'&&s.phase==='arrived')arrived.push(s.index);}expect(s.phase).toBe('complete');expect(s.playing).toBe(false);expect(arrived).toEqual([0,1,2,3,4]);expect(s.visited).toEqual(arrived);});
 it('中途回看返回出发节点，不跳过两站',()=>{const s=nextLeg(selectStop(startJourney(),2));expect(s.from).toBe(2);expect(previousStop(s).index).toBe(2);});
 it('暂停抵达停留时也冻结自动转场',()=>{const s={...startJourney(true),playing:false,hold:8.9};expect(tickJourney(s,.1)).toEqual(s);});
 it('播放倍速只影响展示时间，不修改地理端点',()=>{const s=nextLeg(startJourney());const a=tickJourney(s,.1,1),b=tickJourney(s,.1,2);expect(b.progress).toBeCloseTo(a.progress*2);expect(b.index).toBe(a.index);expect(b.from).toBe(a.from);});
});
