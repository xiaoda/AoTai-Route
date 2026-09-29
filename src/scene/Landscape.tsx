import { useEffect, useMemo, useRef } from 'react';
import { BufferGeometry, Float32BufferAttribute, Color, InstancedMesh, Object3D } from 'three';
import { type TerrainData, type Rock, sampleTerrain, trailX, random } from '../world/terrain';
import { ROCK_VERTICES, ROCK_INDICES } from '../world/rockShape';

function terrainGeometry(terrain: TerrainData) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(terrain.positions, 3));
  geometry.setIndex(Array.from(terrain.indices));
  geometry.computeVertexNormals();
  const colors = new Float32Array(terrain.positions.length);
  const grass = new Color('#687056'), dark = new Color('#3e5145'), path = new Color('#a3987d');
  const rand = random(22), c = new Color();
  for (let i = 0; i < terrain.positions.length; i += 3) {
    const x = terrain.positions[i], z = terrain.positions[i + 2];
    const d = Math.abs(x - trailX(z));
    const patch = (Math.sin(x * 0.21 + z * 0.08) * Math.cos(z * 0.17) + 1) / 2;
    c.copy(dark).lerp(grass, patch * 0.65 + rand() * 0.25);
    if (d < 2.8) c.lerp(path, Math.max(0, 1 - Math.max(0, d - 1.2) / 1.6) * 0.88);
    colors.set([c.r, c.g, c.b], i);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
function mountainGeometry() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const radial = 32, sides = 180;
  const c = new Color(), near = new Color('#52675f'), far = new Color('#8a9e9d');
  for (let r = 0; r <= radial; r++) for (let j = 0; j <= sides; j++) {
    const angle = j / sides * Math.PI * 2;
    const distance = 155 + r / radial * 1550;
    const peaks = 0.42 + Math.abs(Math.sin(angle * 3.1 + 1)) * 0.35
      + Math.sin(angle * 11 + 2) * 0.1 + Math.cos(angle * 23) * 0.05;
    const ridge = Math.sin(r / radial * Math.PI * 3.4 - 0.25) * 0.5 + 0.5;
    const y = -12 + (70 + distance * 0.22) * peaks * ridge * Math.min(1, r / 3);
    positions.push(Math.sin(angle) * distance, y, Math.cos(angle) * distance);
    c.copy(near).lerp(far, r / radial * 0.6);
    colors.push(c.r, c.g, c.b);
    if (r < radial && j < sides) {
      const a = r * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}
function Rocks({ rocks }: { rocks: Rock[] }) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(ROCK_VERTICES, 3));
    g.setIndex(ROCK_INDICES); g.computeVertexNormals(); return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (!ref.current) return;
    const dummy = new Object3D(), rand = random(72), color = new Color();
    rocks.forEach((rock, i) => {
      dummy.position.set(rock.x, rock.y, rock.z);
      dummy.rotation.set(0, rock.rotation, 0);
      dummy.scale.set(rock.hx, rock.hy, rock.hz);
      dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.14, 0.055, 0.32 + rand() * 0.18); ref.current!.setColorAt(i, color);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [rocks]);
  return <instancedMesh ref={ref} args={[geometry, undefined, rocks.length]}>
    <meshStandardMaterial roughness={1} flatShading />
  </instancedMesh>;
}
function Scrub({ terrain, count }: { terrain: TerrainData; count: number }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const rand = random(88), dummy = new Object3D(), color = new Color();
    for (let i = 0; i < count; i++) {
      let x = (rand() - 0.5) * 245, z = (rand() - 0.5) * 245;
      if (Math.abs(x - trailX(z)) < 2.8) x += 6;
      const s = 0.13 + rand() * 0.5;
      dummy.position.set(x, sampleTerrain(terrain, x, z) + s * 0.18, z);
      dummy.scale.set(s, s * (0.4 + rand() * 0.5), s);
      dummy.rotation.set(0, rand() * Math.PI, 0); dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      color.setHSL(0.2 + rand() * 0.05, 0.2, 0.18 + rand() * 0.14); ref.current.setColorAt(i, color);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [terrain, count]);
  return <instancedMesh ref={ref} args={[undefined, undefined, count]}>
    <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial roughness={1} flatShading />
  </instancedMesh>;
}
export default function Landscape({ terrain, rocks, eco }: { terrain: TerrainData; rocks: Rock[]; eco: boolean }) {
  const ground = useMemo(() => terrainGeometry(terrain), [terrain]);
  const mountains = useMemo(mountainGeometry, []);
  useEffect(() => () => { ground.dispose(); mountains.dispose(); }, [ground, mountains]);
  return <>
    <color attach="background" args={['#b9c9c9']} />
    <fog attach="fog" args={['#b9c9c9', 110, 1150]} />
    <hemisphereLight args={['#dfebe9', '#34392e', 2.0]} />
    <directionalLight position={[-140, 160, -80]} color="#ffead2" intensity={2.4} />
    <mesh geometry={ground}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    <mesh geometry={mountains}><meshStandardMaterial vertexColors flatShading roughness={1} /></mesh>
    <Rocks rocks={rocks} />
    <Scrub terrain={terrain} count={eco ? 700 : 1800} />
    <mesh position={[-360, 310, -1150]}><sphereGeometry args={[35, 24, 16]} /><meshBasicMaterial color="#f5edce" fog={false} /></mesh>
  </>;
}
