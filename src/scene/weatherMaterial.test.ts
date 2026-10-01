import { expect, test, vi } from 'vitest';
import { MeshStandardMaterial, ShaderLib } from 'three';
import { applyCloudShadow, cloudNoise, createWeatherUniforms } from './weatherMaterial';

test('程序云图可平铺、确定且取值有效',()=>{
  for(const [x,y] of [[0,0],[.2,.6],[-.3,1.7],[.999,.001]]){
    const n=cloudNoise(x,y);expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThanOrEqual(1);
    expect(cloudNoise(x+1,y-1)).toBeCloseTo(n,10);expect(cloudNoise(x,y)).toBe(n);
  }
});
test('云影组合原始材质 hook，覆盖直接光而非雾或整体画面',()=>{
  const uniforms=createWeatherUniforms(),m=new MeshStandardMaterial();
  const original=vi.fn((shader:{fragmentShader:string})=>{shader.fragmentShader='// kept original\n'+shader.fragmentShader;});
  m.onBeforeCompile=original;m.customProgramCacheKey=()=> 'base-v1';applyCloudShadow(m,uniforms);
  const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}};
  m.onBeforeCompile(shader as never,{} as never);
  expect(original).toHaveBeenCalledOnce();expect(shader.fragmentShader).toContain('// kept original');
  expect(shader.vertexShader).toContain('vWeatherWorld');expect(shader.fragmentShader).toContain('reflectedLight.directDiffuse *= cloudLight');
  expect(shader.fragmentShader).toContain('#include <fog_fragment>');expect(shader.uniforms).toHaveProperty('uCloudMap',uniforms.uCloudMap);
  expect(m.customProgramCacheKey()).toContain('base-v1');uniforms.uCloudMap.value.dispose();m.dispose();
});
