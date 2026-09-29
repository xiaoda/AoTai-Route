/** 原创低面数测试岩块；显示与凸包碰撞共用这组顶点，非扫描资产。 */
const t = (1 + Math.sqrt(5)) / 2;
const raw = [-1,t,0, 1,t,0, -1,-t,0, 1,-t,0, 0,-1,t, 0,1,t, 0,-1,-t, 0,1,-t, t,0,-1, t,0,1, -t,0,-1, -t,0,1];
export const ROCK_VERTICES = new Float32Array(raw.map((value, i) => value / t * (0.88 + (Math.floor(i / 3) % 4) * 0.04)));
export const ROCK_INDICES = [0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8, 3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1];
export function scaledRockVertices(x: number, y: number, z: number) {
  return new Float32Array(ROCK_VERTICES.map((value, i) => value * [x, y, z][i % 3]));
}
