import { DataTexture, RGBAFormat, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, Vector2, Vector3, MeshStandardMaterial } from 'three';

const fract=(x:number)=>x-Math.floor(x);
const ease=(x:number)=>x*x*(3-2*x);
function tileNoise(x:number,y:number,frequency:number) {
  const u=fract(x)*frequency,v=fract(y)*frequency,ix=Math.floor(u),iy=Math.floor(v),a=ease(u-ix),b=ease(v-iy);
  const hash=(i:number,j:number)=>fract(Math.sin((i%frequency)*127.1+(j%frequency)*311.7+73.17)*43758.5453);
  return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;
}
/** 固定种子、周期一的 FBM；原创程序纹理，无摄影/气象数据。 */
export function cloudNoise(x:number,y:number) {
  const n=tileNoise(x,y,3)*.5+tileNoise(x,y,6)*.25+tileNoise(x,y,12)*.13+tileNoise(x,y,24)*.075+tileNoise(x,y,48)*.045;
  return Math.max(0,Math.min(1,(n-.23)*1.8));
}
export function createWeatherUniforms() {
  const size=256,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const k=(y*size+x)*4,v=Math.round(cloudNoise(x/size,y/size)*255);
    data[k]=data[k+1]=data[k+2]=v;data[k+3]=255;
  }
  const texture=new DataTexture(data,size,size,RGBAFormat);
  texture.wrapS=texture.wrapT=RepeatWrapping;texture.magFilter=LinearFilter;texture.minFilter=LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;
  return {
    uCloudMap:{value:texture},uCloudOffset:{value:new Vector2()},uCloudCoverage:{value:.1},uCloudShadow:{value:.12},
    uCloudHeight:{value:1500},uCloudScale:{value:1/2400},uSunDirection:{value:new Vector3(-220,330,154).normalize()},
    uSkyTop:{value:new Vector3(.31,.49,.63)},uSkyHorizon:{value:new Vector3(.77,.82,.82)},
    uOvercast:{value:0},uMist:{value:0},uCloudDetail:{value:1},
  };
}
export type WeatherUniforms=ReturnType<typeof createWeatherUniforms>;
export const CLOUD_GLSL = `
uniform sampler2D uCloudMap;
uniform vec2 uCloudOffset;
uniform float uCloudCoverage, uCloudShadow, uCloudHeight, uCloudScale;
uniform vec3 uSunDirection;
float cloudCover(float noiseValue) {
  return smoothstep(.72-.40*uCloudCoverage,.94-.42*uCloudCoverage,noiseValue);
}
`;

/** 组合原始材质，不覆盖地表细节/植被渐隐；只遮直接光，雾和环境光不变黑。 */
export function applyCloudShadow(material:MeshStandardMaterial,uniforms:WeatherUniforms) {
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey.call(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vWeatherWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
      vec4 weatherPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        weatherPosition=instanceMatrix*weatherPosition;
      #endif
      vWeatherWorld=(modelMatrix*weatherPosition).xyz;
      #include <project_vertex>
    `);
    shader.fragmentShader=CLOUD_GLSL+'\nvarying vec3 vWeatherWorld;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`
      #include <lights_fragment_end>
      vec2 cloudProjection=vWeatherWorld.xz+uSunDirection.xz*(uCloudHeight-vWeatherWorld.y)/uSunDirection.y;
      float cloudLight=1.-cloudCover(texture2D(uCloudMap,cloudProjection*uCloudScale+uCloudOffset).r)*uCloudShadow;
      reflectedLight.directDiffuse *= cloudLight;
      reflectedLight.directSpecular *= cloudLight;
    `);
  };
  material.customProgramCacheKey=()=>cacheKey+'-cloud-shadow-v1';
  return material;
}
