# Animation System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full 3D animation pipeline — scene setup with GLB assets, physics-based animation recorder, JSON-based animation player with texture remapping, and the `/studio` dev tool for recording and managing the animation library.

**Architecture:** `sceneSetup.ts` initialises the shared Three.js scene; `DiceRenderer.ts` manages dice meshes cloned from a GLB; `AnimationRecorder.ts` runs Cannon-es and captures frame data; `AnimationPlayer.ts` replays frames without physics; `textureRemap.ts` permutes material slots; `animationLibrary.ts` fetches and caches JSON via a manifest; `StudioScene.ts` + `StudioScreen.tsx` compose the dev UI with a Vite plugin save endpoint.

**Tech Stack:** Three.js (GLTFLoader, AnimationMixer not used), Cannon-es, Qwik, Vite plugin API, Vitest

**Spec:** `docs/superpowers/specs/2026-03-17-dice-game-design.md`

**Prerequisite:** Plan 1 (Game Logic) must be complete. Assets (`public/models/dice.glb`, `public/models/board.glb`, `public/textures/face_1.png`–`face_6.png`) must exist before running the studio.

---

## Chunk 1: Scene Setup & Dice Renderer

### Task 1: `sceneSetup.ts` — camera, lights, floor, physics world

**Files:**
- Create: `src/scene/sceneSetup.ts`
- Retire (reference only, do not delete): `src/diceLogic/diceLogic.ts`, `src/diceLogic/settings.ts`

- [ ] **Step 1: Create `src/scene/sceneSetup.ts`**

```ts
// src/scene/sceneSetup.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SceneRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  world: CANNON.World;
  groundBody: CANNON.Body;
  onResize: () => void;
}

export async function initScene(canvas: HTMLCanvasElement): Promise<SceneRefs> {
  // Scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  // Camera
  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 3000);
  camera.position.set(0.3, 20, 5);
  camera.lookAt(0, 0, 0);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(3, 10, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  // Board (GLB) — falls back to PlaneGeometry if GLB not available
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/board.glb');
    gltf.scene.receiveShadow = true;
    scene.add(gltf.scene);
  } catch {
    const planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 13),
      new THREE.MeshPhongMaterial({ color: 0x592c0c }),
    );
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.receiveShadow = true;
    scene.add(planeMesh);
  }

  // Physics world
  const world = new CANNON.World();
  world.gravity.set(0, -20.82, 0);
  world.defaultContactMaterial.restitution = 0.2;
  world.defaultContactMaterial.friction = 0.4;
  world.defaultContactMaterial.contactEquationStiffness = 1e9;

  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
  world.addBody(groundBody);

  // Invisible walls (same dimensions as current walls.ts)
  const wallPositions = [
    { pos: [0, 1, -6.5] as const, rot: [0, 0, 0] as const },
    { pos: [0, 1, 6.5] as const, rot: [Math.PI, 0, 0] as const },
    { pos: [-6.5, 1, 0] as const, rot: [0, Math.PI / 2, 0] as const },
    { pos: [6.5, 1, 0] as const, rot: [0, -Math.PI / 2, 0] as const },
  ];
  for (const { pos, rot } of wallPositions) {
    const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    wallBody.position.set(...pos);
    wallBody.quaternion.setFromEuler(...rot);
    world.addBody(wallBody);
  }

  // Resize handler
  const onResize = () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  };
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, world, groundBody, onResize };
}

export function disposeScene(refs: SceneRefs): void {
  window.removeEventListener('resize', refs.onResize);
  refs.renderer.dispose();
}
```

- [ ] **Step 2: Verify it compiles (no test needed for pure setup)**

```bash
cd /Volumes/T7/Projects/dice && pnpm build 2>&1 | head -30
```
Expected: no TypeScript errors in `src/scene/sceneSetup.ts`

- [ ] **Step 3: Commit**

```bash
git add src/scene/sceneSetup.ts
git commit -m "feat(scene): scene setup with GLB board fallback and physics world"
```

---

### Task 2: `DiceRenderer.ts` — dice mesh management with GLB + texture loading

**Files:**
- Create: `src/scene/DiceRenderer.ts`

The face-slot order `[2, 5, 1, 6, 3, 4]` is the authoritative mapping from Three.js `BoxGeometry` material slot index (0–5) to face value, inherited from `diceLogic/dice.ts`.

- [ ] **Step 1: Create `src/scene/DiceRenderer.ts`**

```ts
// src/scene/DiceRenderer.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** slot index → face value (authoritative mapping from diceLogic/dice.ts) */
export const FACE_ORDER = [2, 5, 1, 6, 3, 4] as const;

export interface DiceMeshEntry {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  baseMaterials: THREE.MeshStandardMaterial[]; // slot-indexed, unmodified
}

let cachedDieGeometry: THREE.BufferGeometry | null = null;
let cachedBaseMaterials: THREE.MeshStandardMaterial[] | null = null;

async function loadDieAssets(): Promise<{
  geometry: THREE.BufferGeometry;
  materials: THREE.MeshStandardMaterial[];
}> {
  if (cachedDieGeometry && cachedBaseMaterials) {
    return { geometry: cachedDieGeometry, materials: cachedBaseMaterials };
  }

  // Load face textures face_1.png … face_6.png
  const loader = new THREE.TextureLoader();
  const textures = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(n => loader.loadAsync(`/textures/face_${n}.png`))
  );

  // Build materials indexed by face value (textures[0] = face 1, etc.)
  const faceToMat = textures.map(tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex });
  });

  // Arrange into slot order: slot i → material for FACE_ORDER[i]
  const materials = FACE_ORDER.map(face => faceToMat[face - 1].clone());

  // Load die geometry from GLB; fallback to BoxGeometry
  let geometry: THREE.BufferGeometry;
  try {
    const gltfLoader = new GLTFLoader();
    const gltf = await gltfLoader.loadAsync('/models/dice.glb');
    const mesh = gltf.scene.children[0] as THREE.Mesh;
    geometry = mesh.geometry;
  } catch {
    geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  }

  cachedDieGeometry = geometry;
  cachedBaseMaterials = materials;
  return { geometry, materials };
}

export async function createDiceEntries(
  count: number,
  scene: THREE.Scene,
  world: CANNON.World,
): Promise<DiceMeshEntry[]> {
  const { geometry, materials } = await loadDieAssets();
  const entries: DiceMeshEntry[] = [];

  for (let i = 0; i < count; i++) {
    const clonedMats = materials.map(m => m.clone());
    const mesh = new THREE.Mesh(geometry, clonedMats);
    mesh.castShadow = true;
    mesh.userData.meshIndex = i;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25));
    const body = new CANNON.Body({ mass: 1, shape });
    body.position.set((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4);
    world.addBody(body);

    entries.push({ mesh, body, baseMaterials: clonedMats });
  }

  return entries;
}

export function syncMeshesToBodies(entries: DiceMeshEntry[]): void {
  for (const { mesh, body } of entries) {
    mesh.position.copy(body.position as unknown as THREE.Vector3);
    mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
  }
}

export function removeDiceFromScene(
  entries: DiceMeshEntry[],
  scene: THREE.Scene,
  world: CANNON.World,
): void {
  for (const { mesh, body } of entries) {
    scene.remove(mesh);
    world.removeBody(body);
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm build 2>&1 | head -30
```
Expected: no TypeScript errors in `src/scene/DiceRenderer.ts`

- [ ] **Step 3: Commit**

```bash
git add src/scene/DiceRenderer.ts
git commit -m "feat(scene): dice renderer with GLB loading, face texture mapping, and physics bodies"
```

---

## Chunk 2: Texture Remap

### Task 3: `textureRemap.ts` — material slot permutation

**Files:**
- Create: `src/animation/textureRemap.ts`
- Create: `src/animation/textureRemap.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/animation/textureRemap.test.ts
import { describe, expect, it } from 'vitest';
import { buildRemappedMaterials } from './textureRemap';

// Mock materials (just objects with an id for identity testing)
const makeMats = () => [0, 1, 2, 3, 4, 5].map(i => ({ id: i }) as any);

describe('buildRemappedMaterials', () => {
  it('returns 6 materials', () => {
    const mats = makeMats();
    const result = buildRemappedMaterials(mats, 3, 1);
    expect(result).toHaveLength(6);
  });

  it('swaps so that animFinalFace slot now holds desiredFace material', () => {
    // FACE_ORDER = [2, 5, 1, 6, 3, 4]
    // animFinalFace=3 → slot 4 (FACE_ORDER[4]=3)
    // desiredFace=1  → lives at slot 2 (FACE_ORDER[2]=1)
    // After remap: slot 4 should contain what was at slot 2
    const mats = makeMats();
    const original = [...mats];
    const result = buildRemappedMaterials(mats, 3, 1);
    // Slot 4 (animFinalFace slot) must now contain the material for face 1
    // which was originally at slot 2
    expect(result[4]).toBe(original[2]);
  });

  it('when animFinalFace === desiredFace, materials are unchanged', () => {
    const mats = makeMats();
    const result = buildRemappedMaterials(mats, 3, 3);
    result.forEach((m, i) => expect(m).toBe(mats[i]));
  });

  it('does not mutate the input array', () => {
    const mats = makeMats();
    const original = [...mats];
    buildRemappedMaterials(mats, 3, 1);
    mats.forEach((m, i) => expect(m).toBe(original[i]));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/animation/textureRemap.test.ts
```
Expected: FAIL — `Cannot find module './textureRemap'`

- [ ] **Step 3: Implement `textureRemap.ts`**

```ts
// src/animation/textureRemap.ts
import type * as THREE from 'three';
import { FACE_ORDER } from '../scene/DiceRenderer';

/**
 * Builds a remapped copy of `materials` so that the slot which
 * naturally shows `animFinalFace` in the animation now shows
 * `desiredFace` instead.
 *
 * Only the top-face slot matters for game correctness; the other
 * 5 slots may be arbitrarily reordered (spec §5, Texture Remap Scope).
 *
 * Does not mutate the input array.
 */
export function buildRemappedMaterials(
  materials: THREE.Material[],
  animFinalFace: number,
  desiredFace: number,
): THREE.Material[] {
  if (animFinalFace === desiredFace) return [...materials];

  const result = [...materials];
  const animSlot = FACE_ORDER.indexOf(animFinalFace as typeof FACE_ORDER[number]);
  const desiredSlot = FACE_ORDER.indexOf(desiredFace as typeof FACE_ORDER[number]);

  if (animSlot === -1 || desiredSlot === -1) return result; // guard: invalid face value

  // Swap so the top-face slot (animSlot) now holds the desired material
  [result[animSlot], result[desiredSlot]] = [result[desiredSlot], result[animSlot]];
  return result;
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pnpm test -- src/animation/textureRemap.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/animation/textureRemap.ts src/animation/textureRemap.test.ts
git commit -m "feat(animation): texture remap — permutes material slots to land desired face up"
```

---

## Chunk 3: Animation Library & Player

### Task 4: `animationLibrary.ts` — manifest fetch and JSON caching

**Files:**
- Create: `src/animation/animationLibrary.ts`
- Create: `src/animation/animationLibrary.test.ts`
- Create: `public/animations/manifest.json` (empty initial state)

- [ ] **Step 1: Create empty manifest**

```json
{}
```
Save to `public/animations/manifest.json`.

- [ ] **Step 2: Write failing tests using fetch mocking**

```ts
// src/animation/animationLibrary.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadManifest, pickAnimation, type AnimationData } from './animationLibrary';

const MOCK_ANIM: AnimationData = {
  diceCount: 2,
  duration: 2.5,
  finalFaces: [3, 5],
  frames: [{ t: 0, dice: [{ px: 0, py: 5, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }, { px: 1, py: 5, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }] }],
};

beforeEach(() => {
  vi.restoreAllMocks();
  clearManifestCache(); // reset module-level manifest + anim caches between tests
});

describe('loadManifest', () => {
  it('returns parsed manifest object', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ '2d': ['anim_2d_001.json'] }),
    } as any);
    const manifest = await loadManifest();
    expect(manifest['2d']).toContain('anim_2d_001.json');
  });
});

describe('pickAnimation', () => {
  it('returns animation data for existing dice count', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ '2d': ['anim_2d_001.json'] }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_ANIM } as any);
    const anim = await pickAnimation(2);
    expect(anim.diceCount).toBe(2);
    expect(anim.finalFaces).toHaveLength(2);
  });

  it('falls back to nearest smaller count if exact count missing', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ '1d': ['anim_1d_001.json'] }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...MOCK_ANIM, diceCount: 1, finalFaces: [3] }) } as any);
    const anim = await pickAnimation(3); // no 3d, no 2d → falls back to 1d
    expect(anim.diceCount).toBe(1);
  });

  it('throws if no animations exist at all', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any);
    await expect(pickAnimation(2)).rejects.toThrow('No animations available');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- src/animation/animationLibrary.test.ts
```
Expected: FAIL — `Cannot find module './animationLibrary'`

- [ ] **Step 4: Implement `animationLibrary.ts`**

```ts
// src/animation/animationLibrary.ts

export interface AnimationFrame {
  t: number;
  dice: { px: number; py: number; pz: number; qx: number; qy: number; qz: number; qw: number }[];
}

export interface AnimationData {
  diceCount: number;
  duration: number;
  finalFaces: number[];
  frames: AnimationFrame[];
}

type Manifest = Partial<Record<string, string[]>>;

let manifestCache: Manifest | null = null;
const animCache = new Map<string, AnimationData>();

export async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const res = await fetch('/animations/manifest.json');
  if (!res.ok) throw new Error(`Failed to load manifest: ${res.status}`);
  manifestCache = await res.json() as Manifest;
  return manifestCache;
}

export function clearManifestCache(): void {
  manifestCache = null;
  animCache.clear();
}

async function fetchAnimation(path: string): Promise<AnimationData> {
  if (animCache.has(path)) return animCache.get(path)!;
  const res = await fetch(`/animations/${path}`);
  if (!res.ok) throw new Error(`Failed to load animation ${path}: ${res.status}`);
  const data = await res.json() as AnimationData;
  animCache.set(path, data);
  return data;
}

/**
 * Picks a random animation for the given dice count.
 * Falls back to nearest smaller count if exact not available.
 * Throws if no animations exist at all.
 */
export async function pickAnimation(diceCount: number): Promise<AnimationData> {
  const manifest = await loadManifest();

  for (let n = diceCount; n >= 1; n--) {
    const key = `${n}d`;
    const files = manifest[key];
    if (files && files.length > 0) {
      const file = files[Math.floor(Math.random() * files.length)];
      return fetchAnimation(`${key}/${file}`);
    }
  }

  throw new Error('No animations available');
}
```

- [ ] **Step 5: Run tests and verify all pass**

```bash
pnpm test -- src/animation/animationLibrary.test.ts
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/animation/animationLibrary.ts src/animation/animationLibrary.test.ts public/animations/manifest.json
git commit -m "feat(animation): animation library with manifest fetch, caching, and fallback"
```

---

### Task 5: `AnimationPlayer.ts` — keyframe interpolation playback

**Files:**
- Create: `src/animation/AnimationPlayer.ts`
- Create: `src/animation/AnimationPlayer.test.ts`

**Note:** Tests cover `interpolateFrame` only. `playAnimation` uses `requestAnimationFrame` and `performance.now` which are not available in Node/Vitest. It is verified manually via the Studio (Task 8) and the game smoke test (Plan 3, Task 4).

- [ ] **Step 1: Write failing tests**

```ts
// src/animation/AnimationPlayer.test.ts
import { describe, expect, it } from 'vitest';
import { interpolateFrame } from './AnimationPlayer';
import type { AnimationFrame } from './animationLibrary';

describe('interpolateFrame', () => {
  const frame0: AnimationFrame = {
    t: 0,
    dice: [{ px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }],
  };
  const frame1: AnimationFrame = {
    t: 1,
    dice: [{ px: 10, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }],
  };

  it('returns frame0 values at t=0', () => {
    const result = interpolateFrame([frame0, frame1], 0);
    expect(result[0].px).toBeCloseTo(0);
  });

  it('returns frame1 values at t=1', () => {
    const result = interpolateFrame([frame0, frame1], 1);
    expect(result[0].px).toBeCloseTo(10);
  });

  it('linearly interpolates position at t=0.5', () => {
    const result = interpolateFrame([frame0, frame1], 0.5);
    expect(result[0].px).toBeCloseTo(5);
  });

  it('clamps to first frame before t=0', () => {
    const result = interpolateFrame([frame0, frame1], -1);
    expect(result[0].px).toBeCloseTo(0);
  });

  it('clamps to last frame after t=duration', () => {
    const result = interpolateFrame([frame0, frame1], 5);
    expect(result[0].px).toBeCloseTo(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/animation/AnimationPlayer.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `AnimationPlayer.ts`**

```ts
// src/animation/AnimationPlayer.ts
import * as THREE from 'three';
import type { AnimationData, AnimationFrame } from './animationLibrary';
import type { DiceMeshEntry } from '../scene/DiceRenderer';
import { buildRemappedMaterials } from './textureRemap';

export type DieFrameState = {
  px: number; py: number; pz: number;
  qx: number; qy: number; qz: number; qw: number;
};

/**
 * Linearly interpolates position and quaternion between keyframes.
 * Returns one DieFrameState per die for the given time `t`.
 */
export function interpolateFrame(frames: AnimationFrame[], t: number): DieFrameState[] {
  if (frames.length === 0) return [];

  const clampedT = Math.max(frames[0].t, Math.min(frames[frames.length - 1].t, t));

  // Find surrounding frames
  let lo = frames[0];
  let hi = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (frames[i].t <= clampedT && frames[i + 1].t >= clampedT) {
      lo = frames[i];
      hi = frames[i + 1];
      break;
    }
  }

  const span = hi.t - lo.t;
  const alpha = span === 0 ? 0 : (clampedT - lo.t) / span;

  return lo.dice.map((d, i) => {
    const h = hi.dice[i] ?? d;
    // Lerp position
    const px = d.px + (h.px - d.px) * alpha;
    const py = d.py + (h.py - d.py) * alpha;
    const pz = d.pz + (h.pz - d.pz) * alpha;
    // Slerp quaternion
    const qa = new THREE.Quaternion(d.qx, d.qy, d.qz, d.qw);
    const qb = new THREE.Quaternion(h.qx, h.qy, h.qz, h.qw);
    qa.slerp(qb, alpha);
    return { px, py, pz, qx: qa.x, qy: qa.y, qz: qa.z, qw: qa.w };
  });
}

export interface PlaybackHandle {
  stop: () => void;
  promise: Promise<void>;
}

/**
 * Plays an animation on a set of dice meshes.
 * - Applies texture remap before starting.
 * - Disables physics (mass=0) on active dice during playback.
 * - Calls `onComplete` when done; resolves the returned promise.
 */
export function playAnimation(
  animData: AnimationData,
  desiredFaces: number[],
  activeEntries: DiceMeshEntry[],
  onComplete: () => void,
): PlaybackHandle {
  // Apply texture remap per die
  activeEntries.forEach((entry, i) => {
    const animFinalFace = animData.finalFaces[i];
    const desiredFace = desiredFaces[i];
    if (animFinalFace !== undefined && desiredFace !== undefined) {
      entry.mesh.material = buildRemappedMaterials(
        entry.baseMaterials,
        animFinalFace,
        desiredFace,
      ) as THREE.Material[];
    }
    // Freeze physics during playback
    entry.body.mass = 0;
    entry.body.updateMassProperties();
  });

  const startTime = performance.now();
  let rafId: number;
  let stopped = false;

  let resolvePromise!: () => void;
  const promise = new Promise<void>(res => { resolvePromise = res; });

  function tick() {
    if (stopped) return;
    const elapsed = (performance.now() - startTime) / 1000;
    const t = Math.min(elapsed, animData.duration);

    const states = interpolateFrame(animData.frames, t);
    states.forEach((s, i) => {
      const { mesh, body } = activeEntries[i];
      mesh.position.set(s.px, s.py, s.pz);
      mesh.quaternion.set(s.qx, s.qy, s.qz, s.qw);
      body.position.set(s.px, s.py, s.pz);
      body.quaternion.set(s.qx, s.qy, s.qz, s.qw);
    });

    if (elapsed >= animData.duration) {
      // Re-enable physics
      activeEntries.forEach(entry => {
        entry.body.mass = 1;
        entry.body.updateMassProperties();
        entry.body.velocity.setZero();
        entry.body.angularVelocity.setZero();
      });
      onComplete();
      resolvePromise();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => { stopped = true; cancelAnimationFrame(rafId); resolvePromise(); },
    promise,
  };
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pnpm test -- src/animation/AnimationPlayer.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/animation/AnimationPlayer.ts src/animation/AnimationPlayer.test.ts
git commit -m "feat(animation): animation player with keyframe interpolation and texture remap"
```

---

## Chunk 4: Animation Recorder

### Task 6: `AnimationRecorder.ts` — physics sim capture

**Files:**
- Create: `src/animation/AnimationRecorder.ts`
- Create: `src/animation/AnimationRecorder.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/animation/AnimationRecorder.test.ts
import { describe, expect, it } from 'vitest';
import * as CANNON from 'cannon-es';
import { AnimationRecorder } from './AnimationRecorder';

function makeBody(): CANNON.Body {
  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)) });
  body.position.set(0, 5, 0);
  body.velocity.set(1, 2, 0);
  return body;
}

describe('AnimationRecorder', () => {
  it('captures frames after stepping', () => {
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    const body = makeBody();
    world.addBody(body);

    const recorder = new AnimationRecorder([body]);
    for (let i = 0; i < 10; i++) {
      world.step(1 / 60);
      recorder.captureFrame(i / 60);
    }

    const data = recorder.finish([4]);
    expect(data.frames.length).toBe(10);
    expect(data.diceCount).toBe(1); // derived from bodies.length
    expect(data.finalFaces).toEqual([4]);
    expect(data.frames[0].dice[0].py).toBeLessThanOrEqual(5); // fell due to gravity
  });

  it('serialises to valid AnimationData shape', () => {
    const body = makeBody();
    const recorder = new AnimationRecorder([body]);
    recorder.captureFrame(0);
    const data = recorder.finish([2]);
    expect(data).toMatchObject({
      diceCount: 1,
      finalFaces: [2],
      frames: expect.arrayContaining([
        expect.objectContaining({
          t: expect.any(Number),
          dice: expect.arrayContaining([
            expect.objectContaining({ px: expect.any(Number), qw: expect.any(Number) }),
          ]),
        }),
      ]),
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/animation/AnimationRecorder.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `AnimationRecorder.ts`**

```ts
// src/animation/AnimationRecorder.ts
import * as CANNON from 'cannon-es';
import type { AnimationData, AnimationFrame } from './animationLibrary';

export class AnimationRecorder {
  private bodies: CANNON.Body[];
  private frames: AnimationFrame[] = [];

  constructor(bodies: CANNON.Body[]) {
    this.bodies = bodies;
  }

  captureFrame(t: number): void {
    this.frames.push({
      t,
      dice: this.bodies.map(b => ({
        px: b.position.x,
        py: b.position.y,
        pz: b.position.z,
        qx: b.quaternion.x,
        qy: b.quaternion.y,
        qz: b.quaternion.z,
        qw: b.quaternion.w,
      })),
    });
  }

  finish(finalFaces: number[]): AnimationData {
    const duration = this.frames.length > 0 ? this.frames[this.frames.length - 1].t : 0;
    return {
      diceCount: this.bodies.length, // derived; never out of sync
      duration,
      finalFaces,
      frames: [...this.frames],
    };
  }

  reset(): void {
    this.frames = [];
  }
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pnpm test -- src/animation/AnimationRecorder.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/animation/AnimationRecorder.ts src/animation/AnimationRecorder.test.ts
git commit -m "feat(animation): animation recorder captures Cannon-es body states per frame"
```

---

## Chunk 5: Animation Studio

### Task 7: Vite dev plugin — `/api/save-animation` endpoint

**Files:**
- Modify: `vite.config.ts`
- Create: `src/studio/saveAnimationPlugin.ts`

- [ ] **Step 1: Create the Vite plugin**

```ts
// src/studio/saveAnimationPlugin.ts
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { AnimationData } from '../animation/animationLibrary';

type Manifest = Record<string, string[]>;

export function saveAnimationPlugin(): Plugin {
  return {
    name: 'save-animation',
    apply: 'serve', // dev only
    configureServer(server) {
      server.middlewares.use('/api/save-animation', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        for await (const chunk of req) body += chunk;

        let data: AnimationData;
        try {
          data = JSON.parse(body) as AnimationData;
        } catch {
          res.statusCode = 400;
          res.end('Invalid JSON');
          return;
        }

        const publicDir = path.resolve(process.cwd(), 'public/animations');
        const groupDir = path.join(publicDir, `${data.diceCount}d`);
        fs.mkdirSync(groupDir, { recursive: true });

        // Determine next animation index
        const existing = fs.readdirSync(groupDir).filter(f => f.endsWith('.json'));
        const nextIndex = existing.length + 1;
        const filename = `anim_${data.diceCount}d_${String(nextIndex).padStart(3, '0')}.json`;
        fs.writeFileSync(path.join(groupDir, filename), JSON.stringify(data, null, 2));

        // Update manifest
        const manifestPath = path.join(publicDir, 'manifest.json');
        let manifest: Manifest = {};
        if (fs.existsSync(manifestPath)) {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Manifest;
        }
        const key = `${data.diceCount}d`;
        manifest[key] = manifest[key] ?? [];
        if (!manifest[key].includes(filename)) manifest[key].push(filename);
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ filename }));
      });
    },
  };
}
```

- [ ] **Step 2: Register plugin in `vite.config.ts`**

Read the existing `vite.config.ts` first, then add the import and the plugin to the existing `plugins` array:

```ts
// Add this import at the top of vite.config.ts:
import { saveAnimationPlugin } from './src/studio/saveAnimationPlugin';

// Add saveAnimationPlugin() to the existing plugins array (do not alter other plugins):
// plugins: [...existingPlugins, saveAnimationPlugin()]
```

- [ ] **Step 3: Verify dev server starts without error**

```bash
pnpm dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5173/api/save-animation -H "Content-Type: application/json" -d '{"diceCount":1,"duration":0,"finalFaces":[1],"frames":[]}'
```
Expected: `200`

Kill the dev server after testing: `kill %1`

- [ ] **Step 4: Commit**

```bash
git add src/studio/saveAnimationPlugin.ts vite.config.ts
git commit -m "feat(studio): Vite dev plugin for saving recorded animations to public/"
```

---

### Task 8: `StudioScene.ts` + `StudioScreen.tsx` — recording UI

**Files:**
- Create: `src/studio/StudioScene.ts`
- Create: `src/studio/StudioScreen.tsx`

- [ ] **Step 1: Create `StudioScene.ts` — Three.js + Cannon-es scene for the studio**

```ts
// src/studio/StudioScene.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { initScene, disposeScene } from '../scene/sceneSetup';
import { createDiceEntries, syncMeshesToBodies, type DiceMeshEntry } from '../scene/DiceRenderer';
import { AnimationRecorder } from '../animation/AnimationRecorder';
import { getRolledFace } from '../diceLogic/dice';
import type { AnimationData } from '../animation/animationLibrary';

const RECORD_FPS = 60;
const MAX_RECORD_SECONDS = 6;

export interface StudioSceneHandle {
  setDiceCount: (n: number) => void;
  startRecording: () => void;
  stopAndSave: () => Promise<AnimationData | null>;
  reset: () => void;
  dispose: () => void;
}

export async function initStudioScene(canvas: HTMLCanvasElement): Promise<StudioSceneHandle> {
  const refs = await initScene(canvas);
  const { scene, world, renderer, camera } = refs;

  let diceCount = 2;
  let entries: DiceMeshEntry[] = [];
  let recorder: AnimationRecorder | null = null;
  let isRecording = false;
  let recordElapsed = 0;
  let animFrameId: number;

  async function spawnDice(n: number) {
    entries.forEach(e => { scene.remove(e.mesh); world.removeBody(e.body); });
    entries = await createDiceEntries(n, scene, world);
    recorder = null;
    isRecording = false;
    recordElapsed = 0;
  }

  await spawnDice(diceCount);

  // Launch dice with random velocities
  function launchDice() {
    entries.forEach(e => {
      e.body.position.set((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4);
      e.body.velocity.set((Math.random() - 0.5) * 10, 5 + Math.random() * 5, (Math.random() - 0.5) * 10);
      e.body.angularVelocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    });
  }

  const clock = new THREE.Clock();

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    const dt = clock.getDelta();
    world.step(1 / 60, dt, 3);
    syncMeshesToBodies(entries);

    if (isRecording) {
      recordElapsed += dt;
      recorder!.captureFrame(recordElapsed);
      if (recordElapsed >= MAX_RECORD_SECONDS) {
        isRecording = false;
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    setDiceCount: async (n: number) => {
      diceCount = n;
      await spawnDice(n);
    },

    startRecording: () => {
      launchDice();
      recordElapsed = 0;
      recorder = new AnimationRecorder(entries.map(e => e.body));
      isRecording = true;
    },

    stopAndSave: async (): Promise<AnimationData | null> => {
      if (!recorder) return null;
      isRecording = false;

      // Wait until all dice have settled (velocity below threshold), then detect faces.
      // Run extra physics steps if bodies are still moving.
      const MAX_SETTLE_STEPS = 120;
      for (let s = 0; s < MAX_SETTLE_STEPS; s++) {
        const allSettled = entries.every(e => {
          const v = e.body.velocity.lengthSquared();
          const av = e.body.angularVelocity.lengthSquared();
          return v < 0.01 && av < 0.01;
        });
        if (allSettled) break;
        world.step(1 / 60);
      }
      const finalFaces = entries.map(e => getRolledFace(e.body) || 1);

      const data = recorder.finish(finalFaces);

      const res = await fetch('/api/save-animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { console.error('Failed to save animation'); return null; }
      return data;
    },

    reset: async () => { await spawnDice(diceCount); },

    dispose: () => {
      cancelAnimationFrame(animFrameId);
      disposeScene(refs);
    },
  };
}
```

- [ ] **Step 2: Create `StudioScreen.tsx` — Qwik component**

```tsx
// src/studio/StudioScreen.tsx
import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { StudioSceneHandle } from './StudioScene';

export const StudioScreen = component$(() => {
  const canvasRef = useSignal<HTMLCanvasElement>();
  const sceneHandle = useSignal<StudioSceneHandle | null>(null);
  const diceCount = useSignal(2);
  const isRecording = useSignal(false);
  const status = useSignal('');
  // Library: list of saved animations loaded from manifest
  const library = useSignal<Record<string, string[]>>({});

  const refreshLibrary = $(async () => {
    try {
      const res = await fetch('/animations/manifest.json?t=' + Date.now());
      if (res.ok) library.value = await res.json();
    } catch { /* ignore */ }
  });

  useVisibleTask$(async () => {
    if (!canvasRef.value) return;
    const { initStudioScene } = await import('./StudioScene');
    sceneHandle.value = await initStudioScene(canvasRef.value);
    await refreshLibrary();
  });

  return (
    <div style="display:flex;height:100vh;background:#0d1117;color:#fff;font-family:sans-serif;">
      {/* 3D canvas */}
      <div style="flex:1;position:relative;">
        <canvas ref={canvasRef} style="width:100%;height:100%;" />
      </div>

      {/* Right panel */}
      <div style="width:220px;background:#0f172a;padding:16px;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:14px;font-weight:bold;">🎲 Animation Studio</div>

        {/* Dice count selector */}
        <div>
          <div style="font-size:11px;color:#aaa;margin-bottom:6px;">КУБИКОВ</div>
          <div style="display:flex;gap:4px;">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                style={`padding:4px 8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:${diceCount.value === n ? '#2563eb' : '#222'};color:#fff;`}
                onClick$={async () => {
                  diceCount.value = n;
                  await sceneHandle.value?.setDiceCount(n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button
            style={`padding:8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:${isRecording.value ? '#dc2626' : '#1d4ed8'};color:#fff;`}
            onClick$={() => {
              if (!isRecording.value) {
                sceneHandle.value?.startRecording();
                isRecording.value = true;
                status.value = 'Запись...';
              }
            }}
          >
            {isRecording.value ? '⏺ Идёт запись...' : '▶ Запустить + Записать'}
          </button>

          <button
            style="padding:8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:#15803d;color:#fff;"
            onClick$={async () => {
              if (!isRecording.value) return;
              isRecording.value = false;
              status.value = 'Сохранение...';
              const data = await sceneHandle.value?.stopAndSave();
              status.value = data ? `Сохранено! Граней: [${data.finalFaces.join(',')}]` : 'Ошибка сохранения';
              if (data) await refreshLibrary();
            }}
          >
            💾 Стоп и Сохранить
          </button>

          <button
            style="padding:8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:#333;color:#fff;"
            onClick$={async () => {
              isRecording.value = false;
              status.value = '';
              await sceneHandle.value?.reset();
            }}
          >
            🗑 Сбросить
          </button>
        </div>

        {/* Status */}
        {status.value && (
          <div style="font-size:11px;color:#4ade80;background:#0a1f0a;padding:8px;border-radius:4px;">
            {status.value}
          </div>
        )}

        {/* Library */}
        <div style="flex:1;overflow-y:auto;">
          <div style="font-size:11px;color:#aaa;letter-spacing:1px;margin-bottom:6px;">БИБЛИОТЕКА</div>
          {Object.entries(library.value).length === 0
            ? <div style="font-size:11px;color:#333;">Нет записей</div>
            : Object.entries(library.value).map(([key, files]) => (
                <div key={key} style="margin-bottom:8px;">
                  <div style="font-size:10px;color:#555;margin-bottom:3px;">{key}</div>
                  {(files as string[]).map(f => (
                    <div key={f} style="font-size:10px;color:#888;padding:2px 4px;background:#111;border-radius:2px;margin-bottom:2px;">
                      {f}
                    </div>
                  ))}
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Update `src/main.tsx` to add `/studio` dev route**

Read `main.tsx` first. Then wrap the existing `render(...)` call with a dev-only path guard — do **not** replace the file wholesale to avoid discarding any additions made in earlier plans:

```tsx
// Wrap the existing render call. The file should look like this after the edit:
import '@builder.io/qwik/qwikloader.js';
import { render } from '@builder.io/qwik';
import './index.css';
import { App } from './app.tsx';

if (import.meta.env.DEV && window.location.pathname.startsWith('/studio')) {
  import('./studio/StudioScreen').then(({ StudioScreen }) => {
    render(document.getElementById('app') as HTMLElement, <StudioScreen />);
  });
} else {
  render(document.getElementById('app') as HTMLElement, <App />);
}
```

- [ ] **Step 4: Verify studio route responds in dev**

```bash
pnpm dev &
sleep 4
# Check the page returns HTML (not 404)
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/studio
```
Expected: `200`

```bash
# Check save endpoint is registered
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5173/api/save-animation \
  -H "Content-Type: application/json" \
  -d '{"diceCount":1,"duration":0,"finalFaces":[1],"frames":[]}'
```
Expected: `200`

```bash
kill %1
```

Manual follow-up (when a browser is available): open `http://localhost:5173/studio`, verify canvas renders, dice count selector changes count, record/stop/save cycle writes a file to `public/animations/1d/` and updates `manifest.json`.

- [ ] **Step 5: Commit**

```bash
git add src/studio/StudioScene.ts src/studio/StudioScreen.tsx src/main.tsx
git commit -m "feat(studio): animation studio with record/save UI at /studio (dev only)"
```
