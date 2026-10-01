import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, Object3D } from 'three';
import { WeatherController, type WeatherChoice, type WeatherSnapshot } from '../world/weather';
import { terrainHeight } from '../world/terrain';
import { CLOUD_GLSL, type WeatherUniforms } from './weatherMaterial';

export type WeatherReport=WeatherSnapshot & { running:boolean };
interface Props { uniforms:WeatherUniforms; choice:WeatherChoice; running:boolean; eco:boolean; onReport(report:WeatherReport):void }
const FOG_COLORS=[new Color('#b9cbd2'),new Color('#b7c7cf'),new Color('#c4cfd0')];
const SKY_TOP=[[.31,.49,.63],[.39,.51,.61],[.53,.64,.70]];
const SKY_HORIZON=[[.77,.82,.82],[.70,.77,.80],[.77,.82,.82]];
const SKY_FRAGMENT=`
  ${CLOUD_GLSL}
  uniform vec3 uSkyTop,uSkyHorizon;
  uniform float uOvercast,uMist,uCloudDetail;
  varying vec3 vSky;
  void main(){
    vec3 d=normalize(vSky);
    float t=pow(max(d.y,0.),.55);
    vec3 c=mix(uSkyHorizon,uSkyTop,t);
    float sun=max(dot(d,uSunDirection),0.);
    c+=(vec3(.28,.22,.12)*pow(sun,28.)+vec3(.9,.75,.45)*pow(sun,1800.))*(1.-uOvercast*.85);
    // 同一高度平面、世界坐标及云图，天空与山坡云影不会各自漂移。
    vec2 projected=cameraPosition.xz+d.xz*(uCloudHeight-cameraPosition.y)/max(d.y,.025);
    vec2 uv=projected*uCloudScale+uCloudOffset;
    float n=texture2D(uCloudMap,uv).r;
    float cover=cloudCover(n);
    float detail=0.;
    if(uCloudDetail>.5) detail=(texture2D(uCloudMap,uv*4.+vec2(.17,.31)).r-.5)*.06;
    float horizonFade=smoothstep(.025,.16,d.y);
    float alpha=clamp(cover+detail*cover,0.,1.)*horizonFade;
    vec3 cloud=mix(vec3(.92,.93,.91),vec3(.63,.69,.73),cover*.58+uOvercast*.15);
    cloud+=vec3(.05,.04,.015)*pow(sun,8.);
    c=mix(c,cloud,alpha*.94);
    c=mix(c,uSkyHorizon,(1.-smoothstep(0.,.3,d.y))*uMist*.46);
    gl_FragColor=vec4(c,1.);
  }
`;

export default function Weather({uniforms,choice,running,eco,onReport}:Props) {
  const controller=useMemo(()=>new WeatherController(choice),[]);
  const latest=useRef({choice,running,onReport});latest.current={choice,running,onReport};
  const sky=useRef<Mesh>(null),fog=useRef<FogExp2>(null),sun=useRef<DirectionalLight>(null),ambient=useRef<HemisphereLight>(null);
  const target=useMemo(()=>new Object3D(),[]),lastCell=useRef({x:Infinity,z:Infinity});
  const foreground=useRef(!document.hidden&&document.hasFocus());
  const reportElapsed=useRef(1),lastReportRunning=useRef<boolean|null>(null),active=useRef(false);
  useEffect(()=>{
    const focus=()=>{foreground.current=!document.hidden&&document.hasFocus();};
    const blur=()=>{foreground.current=false;};
    window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
    Object.defineProperty(window,'__AOTAI_WEATHER__',{configurable:true,get:()=>({...controller.snapshot(),running:active.current,cloudOffset:uniforms.uCloudOffset.value.toArray(),quality:uniforms.uCloudDetail.value?'balanced':'eco'})});
    return ()=>{window.removeEventListener('blur',blur);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);Reflect.deleteProperty(window,'__AOTAI_WEATHER__');};
  },[controller,uniforms]);
  useEffect(()=>{uniforms.uCloudDetail.value=eco?0:1;if(sun.current)sun.current.shadow.needsUpdate=true;},[eco,uniforms]);
  useFrame(({camera},delta)=>{
    controller.setChoice(latest.current.choice);
    active.current=latest.current.running&&foreground.current;
    controller.advance(delta,active.current);
    const state=controller.snapshot(),p=state.parameters,w=state.weights;
    uniforms.uCloudOffset.value.set(state.elapsed*4/2400,state.elapsed*2/2400);
    uniforms.uCloudCoverage.value=p.coverage;uniforms.uCloudShadow.value=p.cloudShadow;
    uniforms.uOvercast.value=p.overcast;uniforms.uMist.value=p.mist;
    for(let axis=0;axis<3;axis++){
      uniforms.uSkyTop.value.setComponent(axis,SKY_TOP[0][axis]*w[0]+SKY_TOP[1][axis]*w[1]+SKY_TOP[2][axis]*w[2]);
      uniforms.uSkyHorizon.value.setComponent(axis,SKY_HORIZON[0][axis]*w[0]+SKY_HORIZON[1][axis]*w[1]+SKY_HORIZON[2][axis]*w[2]);
    }
    if(fog.current)fog.current.density=p.fog;
    // Color 无向量语义：逐通道混合工作色域中的雾色。
    fog.current?.color.setRGB(FOG_COLORS[0].r*w[0]+FOG_COLORS[1].r*w[1]+FOG_COLORS[2].r*w[2],FOG_COLORS[0].g*w[0]+FOG_COLORS[1].g*w[1]+FOG_COLORS[2].g*w[2],FOG_COLORS[0].b*w[0]+FOG_COLORS[1].b*w[1]+FOG_COLORS[2].b*w[2]);
    if(sun.current){
      sun.current.intensity=p.sun;
      const x=Math.round(camera.position.x/64)*64,z=Math.round(camera.position.z/64)*64;
      if(lastCell.current.x!==x||lastCell.current.z!==z){
        lastCell.current={x,z};const y=terrainHeight(x,z);target.position.set(x,y,z);target.updateMatrixWorld();
        sun.current.position.set(x-220,y+330,z+154);sun.current.shadow.needsUpdate=true;
      }
    }
    if(ambient.current)ambient.current.intensity=p.ambient;
    sky.current?.position.copy(camera.position);
    reportElapsed.current+=Math.min(delta,.1);
    if(reportElapsed.current>=.5||lastReportRunning.current!==active.current){
      latest.current.onReport({...state,running:active.current});reportElapsed.current=0;lastReportRunning.current=active.current;
    }
  });
  return <>
    <color attach="background" args={['#b9cbd2']}/><fogExp2 ref={fog} attach="fog" args={['#b9cbd2',.00024]}/>
    <mesh ref={sky} renderOrder={-1}><sphereGeometry args={[6500,32,16]}/>
      <shaderMaterial side={BackSide} depthWrite={false} toneMapped={false} uniforms={uniforms}
        vertexShader="varying vec3 vSky; void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader={SKY_FRAGMENT}/>
    </mesh>
    <hemisphereLight ref={ambient} args={['#d7e5f4','#555437',.95]}/><primitive object={target}/>
    <directionalLight ref={sun} target={target} color="#fff4df" intensity={2.5} castShadow={!eco}
      shadow-mapSize={[2048,2048]} shadow-camera-left={-185} shadow-camera-right={185} shadow-camera-top={185} shadow-camera-bottom={-185}
      shadow-camera-near={1} shadow-camera-far={700} shadow-normalBias={.1} shadow-bias={-.0003} shadow-autoUpdate={false} shadow-needsUpdate={true}/>
  </>;
}
