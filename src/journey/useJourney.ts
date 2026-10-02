import { useEffect, useState } from 'react';
import { initialJourney, tickJourney } from './model';
export function useReducedMotion(){
 const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 return reduced;
}
export function useJourney(){
 const [state,setState]=useState(initialJourney),[speed,setSpeed]=useState(1);
 useEffect(()=>{if(!state.playing)return;let id=0,last:number|null=null;
 const frame=(time:number)=>{const delta=last===null?0:(time-last)/1000;last=time;if(!document.hidden)setState(s=>tickJourney(s,delta,speed));id=requestAnimationFrame(frame);};
 id=requestAnimationFrame(frame);return()=>cancelAnimationFrame(id);
 },[state.playing,speed]);
 useEffect(()=>{const pause=()=>setState(s=>s.playing?{...s,playing:false}:s);const visibility=()=>{if(document.hidden)pause();};document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',pause);return()=>{document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',pause);};},[]);
 return {state,setState,speed,setSpeed};
}
