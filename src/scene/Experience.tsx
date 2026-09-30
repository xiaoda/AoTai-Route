import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, ACESFilmicToneMapping, PCFShadowMap } from 'three';
import Landscape from './Landscape';
import { buildTerrain, generateRocks, sampleTerrain, terrainHeight } from '../world/terrain';
import { initPhysics, Walker } from '../world/simulation';
import { isMovementKey, movement, turn, type InputState } from '../core/input';
import type { Settings } from '../core/settings';
import { AirTour, type TravelMode } from '../world/tour';
import { projectToRoute, VIEWPOINT, VIEWPOINT_LOOK, VIEWPOINTS, ROUTE } from '../world/route';

export type Mode = 'intro' | 'walking' | 'paused';
export interface Telemetry {
  x: number; y: number; z: number; heading: number; distance: number;
  routeDistance: number; routeOffset: number; complete: boolean; altitude: number;
}
export interface Stats {
  fps: number; frameMs: number; p95: number; calls: number; triangles: number;
  distance: number; height: number; heading: number; grounded: boolean; boundary: boolean;
  x: number; y: number; z: number; renderer: string;
}
interface Props {
  mode: Mode; settings: Settings; resetToken: number; travel: TravelMode; viewpointToken: number; viewpointIndex: number;
  cruising: boolean; speed: number; altitude: number; recenterToken: number; replayToken: number;
  onReady(): void; onPause(): void; onError(message: string): void;
  onStats(stats: Stats): void; onInputMode(locked: boolean): void;
  onTelemetry(telemetry: Telemetry): void; onComplete(): void;
}
function WalkingScene(props: Props) {
  const { camera, gl } = useThree();
  const latest = useRef(props); latest.current = props;
  const terrain = useMemo(() => buildTerrain(), []);
  const rocks = useMemo(() => generateRocks(terrain), [terrain]);
  const walker = useRef<Walker | null>(null);
  const input = useRef<InputState>({ keys: new Set(), yaw: 0, pitch: props.travel === 'air' ? -0.42 : 0.035 });
  const footLook = useRef({ yaw: 0, pitch: 0.035 });
  const tour = useMemo(() => new AirTour(), []);
  const lastTravel = useRef(props.travel), lastRecenter = useRef(props.recenterToken);
  const lastReplay = useRef(props.replayToken);
  const completionSent = useRef(false), mapElapsed = useRef(0);
  const telemetry = useRef<Telemetry | null>(null);
  const samples = useRef<number[]>([]), elapsed = useRef(0);
  const diagnostic = useRef<Stats | null>(null);
  const firstPosition = useRef(true);
  const lastReset = useRef(props.resetToken);
  const lastViewpoint = useRef(0);
  const renderer = useRef('WebGL2');

  useEffect(() => {
    let cancelled = false;
    initPhysics().then(() => {
      if (cancelled) return;
      const {x,z}=ROUTE[0];
      walker.current = new Walker({ terrain, obstacles: rocks, spawn: { x, y: sampleTerrain(terrain, x, z), z } });
      // 先让胶囊稳定落地，再通知 UI 可进入。
      for (let i = 0; i < 20; i++) walker.current.advance(1 / 60, { x: 0, z: 0 });
      latest.current.onReady();
    }).catch(() => latest.current.onError('物理模块加载失败，请刷新重试。'));
    const context = gl.getContext();
    const ext = context.getExtension('WEBGL_debug_renderer_info');
    renderer.current = ext ? String(context.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'WebGL2（设备名称未公开）';
    const canvas = gl.domElement;
    canvas.setAttribute('aria-label', '三维山地体验，半空自动漫游或 WASD 徒步，拖动画面或方向键转头');
    canvas.setAttribute('tabindex', '-1');
    const lost = (event: Event) => { event.preventDefault(); latest.current.onError('图形上下文已中断。请刷新重新进入；本阶段不保存旅程位置。'); };
    canvas.addEventListener('webglcontextlost', lost);
    // 只读诊断，不提供跳过碰撞或修改角色位置的测试捷径。
    Object.defineProperty(window, '__AOTAI_DEBUG__', { configurable: true, get: () => ({
      mode: latest.current.mode, ready: !!walker.current, ...diagnostic.current,
      travel: latest.current.travel, cruising: latest.current.cruising, tourDistance: tour.distance, telemetry: telemetry.current,
      position: latest.current.travel === 'air' ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : walker.current?.position,
      walkerPosition: walker.current?.position, keys: [...input.current.keys],
      rotation: { pitch: camera.rotation.x, yaw: camera.rotation.y, roll: camera.rotation.z },
      locked: document.pointerLockElement === canvas,
    }) });
    return () => {
      cancelled = true; walker.current?.dispose(); walker.current = null;
      canvas.removeEventListener('webglcontextlost', lost);
      Reflect.deleteProperty(window, '__AOTAI_DEBUG__');
    };
  }, [gl, terrain, rocks, camera, tour]);

  useEffect(() => {
    const c = camera as PerspectiveCamera;
    c.fov = props.settings.fov; c.updateProjectionMatrix();
  }, [camera, props.settings.fov]);

  useEffect(() => {
    if (props.mode !== 'walking') { input.current.keys.clear(); walker.current?.pause(); }
  }, [props.mode]);

  useEffect(() => {
    const canvas = gl.domElement;
    let dragging = false, lastX = 0, lastY = 0, wasLocked = false;
    const active = () => latest.current.mode === 'walking';
    const stop = () => {
      input.current.keys.clear(); dragging = false; walker.current?.pause();
      if (active()) latest.current.onPause();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (!active() || (event.target instanceof Element && event.target.closest('input, select, textarea, button'))) return;
      if (isMovementKey(event.code)) { event.preventDefault(); input.current.keys.add(event.code); }
      if (event.code === 'Escape') stop();
    };
    const keyUp = (event: KeyboardEvent) => input.current.keys.delete(event.code);
    const mouseMove = (event: MouseEvent) => {
      if (!active()) return;
      if (document.pointerLockElement === canvas) turn(input.current, event.movementX, event.movementY, latest.current.settings.sensitivity);
    };
    const pointerDown = (event: PointerEvent) => {
      if (!active() || document.pointerLockElement === canvas || event.button !== 0) return;
      canvas.focus();
      dragging = true; lastX = event.clientX; lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!active() || !dragging || document.pointerLockElement === canvas) return;
      turn(input.current, event.clientX - lastX, event.clientY - lastY, latest.current.settings.sensitivity);
      lastX = event.clientX; lastY = event.clientY;
    };
    const pointerUp = () => { dragging = false; };
    const visibility = () => { if (document.hidden) stop(); };
    const locked = () => {
      const now = document.pointerLockElement === canvas;
      latest.current.onInputMode(now);
      if (wasLocked && !now) stop();
      wasLocked = now;
    };
    const lockError = () => latest.current.onInputMode(false);
    window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', visibility);
    document.addEventListener('mousemove', mouseMove);
    document.addEventListener('pointerlockchange', locked); document.addEventListener('pointerlockerror', lockError);
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
    return () => {
      input.current.keys.clear();
      window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('mousemove', mouseMove);
      document.removeEventListener('pointerlockchange', locked); document.removeEventListener('pointerlockerror', lockError);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const w = walker.current, p = latest.current;
    if (!w) return;
    let forceTelemetry = false;
    if (lastTravel.current !== p.travel) {
      if (p.travel === 'air') {
        footLook.current = { yaw: input.current.yaw, pitch: input.current.pitch };
        tour.seek(projectToRoute(w.position).distance);
        input.current.yaw = 0; input.current.pitch = p.altitude === 30 ? -0.42 : -0.25;
      } else {
        input.current.yaw = footLook.current.yaw; input.current.pitch = footLook.current.pitch;
      }
      input.current.keys.clear(); w.pause(); firstPosition.current = true;
      completionSent.current = false; lastTravel.current = p.travel; forceTelemetry = true;
    }
    if (lastReset.current !== p.resetToken) {
      w.reset(); tour.reset(); completionSent.current = false;
      footLook.current = { yaw: 0, pitch: 0.035 };
      input.current.keys.clear(); input.current.yaw = 0; input.current.pitch = p.travel === 'air' ? (p.altitude === 30 ? -0.42 : -0.25) : 0.035;
      lastReset.current = p.resetToken; firstPosition.current = true;
      forceTelemetry = true;
    }
    if (lastRecenter.current !== p.recenterToken) {
      input.current.yaw = 0; input.current.pitch = p.travel === 'air' ? (p.altitude === 30 ? -0.42 : -0.25) : 0.035;
      lastRecenter.current = p.recenterToken; forceTelemetry = true;
    }
    if (lastReplay.current !== p.replayToken) {
      tour.reset(); completionSent.current = false; input.current.keys.clear();
      input.current.yaw = 0; input.current.pitch = p.altitude === 30 ? -0.42 : -0.25;
      firstPosition.current = true; lastReplay.current = p.replayToken; forceTelemetry = true;
    }
    if (lastViewpoint.current !== p.viewpointToken) {
      const viewpoint=VIEWPOINTS[p.viewpointIndex]??VIEWPOINT;
      if(p.travel==='air')tour.seek(viewpoint.distance);
      else {w.moveToViewpoint(viewpoint.x,viewpoint.z);for(let i=0;i<20;i++)w.advance(1/60,{x:0,z:0});}
      input.current.keys.clear();input.current.yaw=viewpoint.yaw;input.current.pitch=p.travel==='air'?viewpoint.airPitch:viewpoint.footPitch;
      if(p.travel==='foot')footLook.current={yaw:input.current.yaw,pitch:input.current.pitch};
      firstPosition.current=true;completionSent.current=false;forceTelemetry=true;lastViewpoint.current=p.viewpointToken;
    }
    if (p.mode === 'intro') {
      camera.position.set(VIEWPOINT.x, sampleTerrain(terrain, VIEWPOINT.x, VIEWPOINT.z) + 30, VIEWPOINT.z);
      camera.rotation.set(VIEWPOINT_LOOK.airPitch,VIEWPOINT_LOOK.yaw,0,'YXZ');
    } else {
      if (p.mode === 'walking') {
        const dt = Math.min(delta, 0.1), keys = input.current.keys;
        input.current.yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.2;
        input.current.pitch = Math.max(-1.25, Math.min(1.25, input.current.pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * dt * 0.8));
        if (p.travel === 'air') {
          if (p.cruising) tour.advance(delta, p.speed);
          if (tour.complete && !completionSent.current) {
            completionSent.current = true; forceTelemetry = true; p.onComplete();
          }
        } else w.advance(delta, movement(keys, input.current.yaw));
      }
      const airPose = tour.pose(terrain, p.altitude);
      const eye = p.travel === 'air' ? airPose : w.interpolatedEye;
      const bob = p.travel === 'foot' && p.settings.bob && p.mode === 'walking' && input.current.keys.size > 0 ? Math.sin(w.distance * 7.5) * 0.018 : 0;
      camera.position.x = eye.x; camera.position.z = eye.z;
      // 徒步平滑垂直跨阶、水平用物理插值；漫游缓动跟随地形，不添加滚转与晃动。
      if (firstPosition.current) { camera.position.y = eye.y; firstPosition.current = false; }
      if (p.mode === 'walking') camera.position.y += (eye.y + bob - camera.position.y) * (1 - Math.exp(-(p.travel === 'air' ? 4 : 18) * Math.min(delta, 0.1)));
      // 漫游基础朝向固定；仅主动环顾/回正改变方向，地形和路线弯曲不改变俯仰或滚转。
      camera.rotation.set(input.current.pitch, input.current.yaw + (p.travel === 'air' ? airPose.yaw : 0), 0, 'YXZ');
    }
    const pos = p.travel === 'air' ? camera.position : w.position;
    const heading = ((-camera.rotation.y * 180 / Math.PI) % 360 + 360) % 360;
    mapElapsed.current += delta;
    if (mapElapsed.current >= 0.1 || forceTelemetry) {
      const projection = projectToRoute(pos);
      telemetry.current = { x: pos.x, y: pos.y, z: pos.z, heading,
        distance: p.travel === 'air' ? tour.distance : w.distance,
        routeDistance: p.travel === 'air' ? tour.distance : projection.distance, routeOffset: projection.offset,
        complete: p.travel === 'air' && tour.complete, altitude: Math.max(0, camera.position.y - sampleTerrain(terrain, pos.x, pos.z)) };
      p.onTelemetry(telemetry.current); mapElapsed.current = 0;
    }
    samples.current.push(delta * 1000); elapsed.current += delta;
    if (elapsed.current >= 0.5) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      const stats: Stats = {
        fps: Math.round(samples.current.length / elapsed.current), frameMs: elapsed.current * 1000 / samples.current.length,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        calls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles,
        distance: p.travel === 'air' ? tour.distance : w.distance, height: sampleTerrain(terrain, pos.x, pos.z), heading,
        grounded: p.travel === 'foot' && w.grounded, boundary: p.travel === 'foot' && w.boundaryReached, x: pos.x, y: pos.y, z: pos.z,
        renderer: renderer.current,
      };
      diagnostic.current = stats; latest.current.onStats(stats);
      samples.current = []; elapsed.current = 0;
    }
  });
  return <Landscape terrain={terrain} rocks={rocks} eco={props.settings.quality === 'eco'} />;
}

export default function Experience(props: Props) {
  return <Canvas shadows={{ type: PCFShadowMap }}
    camera={{ fov: props.settings.fov, near: 0.15, far: 7500 }}
    dpr={props.settings.quality === 'eco' ? 0.75 : 1}
    gl={{ antialias: true, powerPreference: 'default', alpha: false }}
    onCreated={({ gl, camera }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; camera.position.set(VIEWPOINT.x,terrainHeight(VIEWPOINT.x,VIEWPOINT.z)+30,VIEWPOINT.z);camera.rotation.set(VIEWPOINT_LOOK.airPitch,VIEWPOINT_LOOK.yaw,0,'YXZ'); }}
    fallback={<span>三维交互区域：需要 WebGL2。使用 WASD 移动，方向键转头，Esc 暂停。</span>}
  ><WalkingScene {...props} /></Canvas>;
}
