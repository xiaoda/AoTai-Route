export interface InputState { keys: Set<string>; yaw: number; pitch: number }
export function movement(keys: Set<string>, yaw: number) {
  let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  let right = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const length = Math.hypot(forward, right);
  if (length > 1) { forward /= length; right /= length; }
  return {
    x: -Math.sin(yaw) * forward + Math.cos(yaw) * right,
    z: -Math.cos(yaw) * forward - Math.sin(yaw) * right,
    slow: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}
export const isMovementKey = (code: string) => ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight'].includes(code);
export function turn(input: InputState, dx: number, dy: number, sensitivity: number) {
  input.yaw -= dx * 0.0018 * sensitivity;
  input.pitch = Math.max(-1.25, Math.min(1.25, input.pitch - dy * 0.0018 * sensitivity));
}
