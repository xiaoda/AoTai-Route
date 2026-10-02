import { LANDMARKS, MAP_BOUNDS, type Coordinate } from './landmarks';
export type Phase='overview'|'travelling'|'arrived'|'complete';
export type JourneyState={phase:Phase;index:number;from:number;progress:number;playing:boolean;continuous:boolean;hold:number;visited:number[]};
export const initialJourney:JourneyState={phase:'overview',index:0,from:0,progress:0,playing:false,continuous:false,hold:0,visited:[]};
export function startJourney(continuous=false):JourneyState{return {...initialJourney,phase:'arrived',playing:continuous,continuous,visited:[0]};}
export function nextLeg(s:JourneyState):JourneyState{
 if(s.phase==='overview'||s.phase==='complete')return startJourney(s.continuous);
 if(s.phase==='travelling')return s;
 if(s.index===LANDMARKS.length-1)return {...s,phase:'complete',playing:false};
 return {...s,phase:'travelling',from:s.index,index:s.index+1,progress:0,hold:0,playing:true};
}
export function selectStop(s:JourneyState,index:number):JourneyState{
 if(!Number.isInteger(index)||index<0||index>=LANDMARKS.length)return s;
 return {...s,phase:'arrived',index,from:index,progress:1,hold:0,playing:false,visited:[...new Set([...s.visited,index])].sort((a,b)=>a-b)};
}
export function previousStop(s:JourneyState):JourneyState{return selectStop(s,Math.max(0,s.phase==='travelling'?s.from:s.index-1));}
export function tickJourney(s:JourneyState,delta:number,speed=1):JourneyState{
 if(!s.playing||!Number.isFinite(delta)||delta<=0||!Number.isFinite(speed)||speed<=0)return s;
 const dt=Math.min(delta,.1)*Math.min(speed,3);
 if(s.phase==='arrived'&&s.continuous){const hold=s.hold+dt;return hold>=9?nextLeg({...s,hold:0}):{...s,hold};}
 if(s.phase!=='travelling')return s;
 const progress=Math.min(1,s.progress+dt/14);
 return progress<1?{...s,progress}:{...s,progress:1,phase:'arrived',playing:s.continuous,hold:0,visited:[...new Set([...s.visited,s.index])].sort((a,b)=>a-b)};
}
export function positionAt(s:JourneyState):Coordinate{
 if(s.phase!=='travelling')return LANDMARKS[s.index].coordinate;
 const a=LANDMARKS[s.from].coordinate,b=LANDMARKS[s.index].coordinate;
 const t=s.progress;if(t<=0)return a;if(t>=1)return b;
 return {lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t};
}
export const MAP_WIDTH=1200,MAP_HEIGHT=650;
export function project(p:Coordinate){return {x:(p.lon-MAP_BOUNDS.west)/(MAP_BOUNDS.east-MAP_BOUNDS.west)*MAP_WIDTH,y:(MAP_BOUNDS.north-p.lat)/(MAP_BOUNDS.north-MAP_BOUNDS.south)*MAP_HEIGHT};}
export function unproject(p:{x:number;y:number}):Coordinate{return {lon:MAP_BOUNDS.west+p.x/MAP_WIDTH*(MAP_BOUNDS.east-MAP_BOUNDS.west),lat:MAP_BOUNDS.north-p.y/MAP_HEIGHT*(MAP_BOUNDS.north-MAP_BOUNDS.south)};}
export type MapFrame={x:number;y:number;width:number;height:number};
export const fullFrame:MapFrame={x:0,y:0,width:MAP_WIDTH,height:MAP_HEIGHT};
export function frameFor(s:JourneyState,focus:boolean):MapFrame{
 if(!focus||s.phase==='overview'||s.phase==='complete')return fullFrame;
 const a=project(LANDMARKS[s.phase==='travelling'?s.from:s.index].coordinate);
 const b=project(LANDMARKS[s.phase==='travelling'?s.index:Math.min(s.index+1,LANDMARKS.length-1)].coordinate);
 const width=Math.min(MAP_WIDTH,Math.max(270,Math.abs(b.x-a.x)*1.7,Math.abs(b.y-a.y)*1.7*MAP_WIDTH/MAP_HEIGHT));
 const height=width*MAP_HEIGHT/MAP_WIDTH,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
 return {x:Math.max(0,Math.min(MAP_WIDTH-width,cx-width/2)),y:Math.max(0,Math.min(MAP_HEIGHT-height,cy-height/2)),width,height};
}
