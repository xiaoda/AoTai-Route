import {expect,test} from 'vitest';
import {buildTerrain,generateRocks,sampleTerrain} from './terrain';
import {pathClearance} from './route';
import {generatePlants} from './vegetation';
test('植被是确定性地表装饰，不侵入行走带、不改高程',()=>{
 const terrain=buildTerrain(),rocks=generateRocks(terrain),plants=generatePlants(terrain,rocks);
 expect(plants).toEqual(generatePlants(terrain,rocks));expect(plants.length).toBeGreaterThan(18000);expect(plants.length).toBeLessThan(180000);
 expect(plants.filter(p=>p.shrub).length).toBeGreaterThan(300);
 for(const p of plants){expect(p.y).toBeCloseTo(sampleTerrain(terrain,p.x,p.z)-.035,6);expect(pathClearance(p.x,p.z)).toBeGreaterThan(1.3);expect(p.scale).toBeLessThan(1.41);}
},30000);
