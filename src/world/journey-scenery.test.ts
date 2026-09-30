import {expect,test} from 'vitest';
import {buildTerrain,generateRocks} from './terrain';
import {generatePlants} from './vegetation';
import {VIEWPOINTS,pathClearance,pointAtDistance,routeLength} from './route';
import {habitatAt} from './habitat';

test('新增节点有不同地表分区，已验收石河不被新分区覆盖',()=>{
 expect(habitatAt(-650,560,3707,.02).meadow).toBeGreaterThan(.75);
 expect(habitatAt(130,-810,3685,.02).stone).toBeGreaterThan(.65);
 expect(habitatAt(-346,-64,3700,.02).stone).toBeGreaterThan(.75);
});
test('三处节点与沿途均有植被/岩块，所有大岩块退出统一路线净空',()=>{
 const t=buildTerrain(),rocks=generateRocks(t),plants=generatePlants(t,rocks);
 for(const p of VIEWPOINTS){expect(rocks.filter(r=>Math.hypot(r.x-p.x,r.z-p.z)<130).length).toBeGreaterThan(40);expect(plants.filter(r=>Math.hypot(r.x-p.x,r.z-p.z)<120).length).toBeGreaterThan(600);}
 for(let d=0;d<routeLength;d+=200){const p=pointAtDistance(d);expect(plants.filter(r=>Math.hypot(r.x-p.x,r.z-p.z)<120).length).toBeGreaterThan(400);}
 for(const r of rocks)expect(pathClearance(r.x,r.z)).toBeGreaterThan(2+Math.max(r.hx,r.hz)*1.4);
});
