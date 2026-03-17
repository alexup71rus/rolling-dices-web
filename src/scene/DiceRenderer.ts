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

  const loader = new THREE.TextureLoader();
  const textures = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(n => loader.loadAsync(`/textures/face_${n}.png`))
  );

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
