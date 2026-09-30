import { expect, test } from 'vitest';
import { habitatAt, stoneRiverCenter } from './habitat';
import { buildTerrain, generateRocks, trailX } from './terrain';

test('石河与草甸是连续分区，不是随机点色，结果可复现', () => {
 for (const z of [-180, -64, 0, 60, 160]) {
  const c=stoneRiverCenter(z), stone=habitatAt(c,z,3700,.02), meadow=habitatAt(c+85,z,3700,.02);
  expect(stone.stone).toBeGreaterThan(.75); expect(meadow.meadow).toBeGreaterThan(.65);
  expect(habitatAt(c+85,z,3700,.02)).toEqual(meadow);
 }
});
test('材质权重归一、越界参数不产生 NaN，非法位置拒绝',()=>{
 for(let z=-500;z<=500;z+=37)for(let x=-500;x<=500;x+=53){const h=habitatAt(x,z,3600,.35);expect(h.stone+h.meadow+h.soil).toBeCloseTo(1,8);for(const v of Object.values(h))expect(v).toBeGreaterThanOrEqual(0);}
 expect(()=>habitatAt(NaN,0,3600,0)).toThrow();
 expect(habitatAt(-200,0,3700,1).meadow).toBeLessThan(.15);
});
test('真实地形不因地表分区改变，大岩块保持路径净空',()=>{
 const terrain=buildTerrain(), before=terrain.positions.slice(), rocks=generateRocks(terrain);
 expect(rocks.length).toBeGreaterThan(1000);expect(rocks.length).toBeLessThan(4500);
 expect(terrain.positions).toEqual(before);expect(generateRocks(terrain)).toEqual(rocks);
 for(const r of rocks)expect(Math.abs(r.x-trailX(r.z))).toBeGreaterThan(2.2+Math.max(r.hx,r.hz)*1.5);
});
