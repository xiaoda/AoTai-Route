import RAPIER from '@dimforge/rapier3d-compat';
import { type Rock, type TerrainData, sampleTerrain } from './terrain';
import { scaledRockVertices } from './rockShape';

export interface Point { x: number; y: number; z: number }
export interface WorldData { terrain: TerrainData; obstacles: Rock[]; spawn: Point }
export interface MoveInput { x: number; z: number; slow?: boolean }
export const STEP = 1 / 60;
const HALF_HEIGHT = 0.52, RADIUS = 0.34, EYE_OFFSET = 0.82;
let initialization: Promise<void> | undefined;
export const initPhysics = () => initialization ??= RAPIER.init();

export class Walker {
  private world: RAPIER.World;
  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private accumulator = 0;
  private velocityY = 0;
  private vx = 0;
  private vz = 0;
  private disposed = false;
  private previous: Point;
  private current: Point;
  private origin: Point;
  private recoveryFloor: number;
  distance = 0;
  grounded = false;
  boundaryReached = false;

  constructor(private data: WorldData) {
    let lowest = Infinity;
    for (let i = 1; i < data.terrain.positions.length; i += 3) lowest = Math.min(lowest, data.terrain.positions[i]);
    this.recoveryFloor = lowest - 40;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    const environment = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(data.terrain.positions, data.terrain.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES), environment);
    for (const r of data.obstacles) {
      const shape = r.shape === 'boulder'
        ? RAPIER.ColliderDesc.convexHull(scaledRockVertices(r.hx, r.hy, r.hz, r.variant))!
        : RAPIER.ColliderDesc.cuboid(r.hx, r.hy, r.hz);
      this.world.createCollider(shape
        .setTranslation(r.x, r.y, r.z)
        .setRotation(r.orientation ?? { x: 0, y: Math.sin(r.rotation / 2), z: 0, w: Math.cos(r.rotation / 2) }), environment);
    }
    this.origin = { x: data.spawn.x, y: data.spawn.y + HALF_HEIGHT + RADIUS + 0.025, z: data.spawn.z };
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(this.origin.x, this.origin.y, this.origin.z));
    this.collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);
    this.controller = this.world.createCharacterController(0.015);
    this.controller.setMaxSlopeClimbAngle(40 * Math.PI / 180);
    this.controller.setMinSlopeSlideAngle(45 * Math.PI / 180);
    this.controller.enableAutostep(0.28, 0.2, false);
    this.controller.enableSnapToGround(0.4);
    this.current = { ...this.origin }; this.previous = { ...this.origin };
    this.world.step();
  }
  get position(): Point { return { ...this.current }; }
  get eyePosition(): Point { return { ...this.current, y: this.current.y + EYE_OFFSET }; }
  get interpolatedEye(): Point {
    const alpha = this.accumulator / STEP;
    return {
      x: this.previous.x + (this.current.x - this.previous.x) * alpha,
      y: this.previous.y + (this.current.y - this.previous.y) * alpha + EYE_OFFSET,
      z: this.previous.z + (this.current.z - this.previous.z) * alpha,
    };
  }
  advance(delta: number, input: MoveInput): void {
    if (this.disposed || !Number.isFinite(delta) || delta <= 0) return;
    this.accumulator += Math.min(delta, 0.1);
    while (this.accumulator + 1e-9 >= STEP) {
      this.tick(input);
      this.accumulator = Math.max(0, this.accumulator - STEP);
    }
  }
  private tick(input: MoveInput): void {
    let x = Number.isFinite(input.x) ? input.x : 0, z = Number.isFinite(input.z) ? input.z : 0;
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    const speed = input.slow ? 0.85 : 1.55;
    const smooth = 1 - Math.exp(-14 * STEP);
    this.vx += (x * speed - this.vx) * smooth;
    this.vz += (z * speed - this.vz) * smooth;
    // 接地时仅保留贴地所需的微小向下位移，避免较大的下压速度抵消跨阶位移。
    this.velocityY = this.grounded ? -0.1 : Math.max(-20, this.velocityY - 9.81 * STEP);
    const edge = this.data.terrain.size / 2 - 3;
    const dx = this.vx * STEP, dz = this.vz * STEP;
    const outsideX = Math.abs(this.current.x + dx) > edge, outsideZ = Math.abs(this.current.z + dz) > edge;
    this.boundaryReached = outsideX || outsideZ;
    this.controller.computeColliderMovement(this.collider, { x: outsideX ? 0 : dx, y: this.velocityY * STEP, z: outsideZ ? 0 : dz });
    const move = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    this.previous = { ...this.current };
    this.body.setNextKinematicTranslation({ x: this.current.x + move.x, y: this.current.y + move.y, z: this.current.z + move.z });
    this.world.step();
    const p = this.body.translation();
    this.current = { x: p.x, y: p.y, z: p.z };
    this.distance += Math.hypot(this.current.x - this.previous.x, this.current.z - this.previous.z);
    if (!Number.isFinite(this.current.y) || this.current.y < this.recoveryFloor) this.reset();
  }
  pause(): void {
    this.accumulator = 0; this.vx = 0; this.vz = 0;
    this.previous = { ...this.current };
  }
  /** 仅由用户明确选择视点触发；Y 始终来自当前碰撞网格。原起点不改变。 */
  moveToViewpoint(x:number,z:number):void {
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.max(Math.abs(x),Math.abs(z))>this.data.terrain.size/2-3)throw new Error('观景点超出可行走范围');
    this.pause();this.velocityY=0;this.distance=0;this.grounded=false;this.boundaryReached=false;
    const p={x,y:sampleTerrain(this.data.terrain,x,z)+HALF_HEIGHT+RADIUS+.025,z};
    this.current={...p};this.previous={...p};this.body.setTranslation(p,true);this.body.setNextKinematicTranslation(p);this.world.step();
  }
  reset(): void {
    this.pause(); this.velocityY = 0; this.distance = 0; this.grounded = false;
    this.current = { ...this.origin }; this.previous = { ...this.origin };
    this.body.setTranslation(this.origin, true);
    this.body.setNextKinematicTranslation(this.origin);
    this.world.step();
  }
  dispose(): void { if (!this.disposed) { this.world.free(); this.disposed = true; } }
}
