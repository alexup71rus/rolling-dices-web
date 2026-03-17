// src/scene/DiceRenderer.ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createRoundedBoxWithGroups } from './DiceGeometry';

/** slot index → face value (authoritative mapping from diceLogic/dice.ts) */
export const FACE_ORDER = [2, 5, 1, 6, 3, 4] as const;

export interface DiceMeshEntry {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  baseMaterials: THREE.Material[]; // slot-indexed, unmodified
  highlightMesh?: THREE.Mesh;
}

let cachedDieGeometry: THREE.BufferGeometry | null = null;
let cachedBaseMaterials: THREE.Material[] | null = null;
let cachedHighlightMaterial: THREE.Material | null = null;

function getHighlightMaterial(): THREE.Material {
  if (cachedHighlightMaterial) return cachedHighlightMaterial;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    // Draw a nice glowing outline circle
    ctx.strokeStyle = '#eab308'; // Amber/Yellow
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner softer glow
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedHighlightMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false, // Prevent z-fighting
    side: THREE.DoubleSide
  });

  return cachedHighlightMaterial;
}

function createFallbackMaterials(): THREE.Material[] {
  // Keep distinct faces even when texture assets are missing.
  const fallbackColors = [0xd9d9d9, 0xcfcfcf, 0xe3e3e3, 0xc6c6c6, 0xededed, 0xbdbdbd];
  return FACE_ORDER.map((_, slot) =>
    new THREE.MeshPhysicalMaterial({ 
      color: fallbackColors[slot],
      roughness: 0.15,
      metalness: 0.1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.2
    })
  );
}

async function loadDieAssets(): Promise<{
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
}> {
  if (cachedDieGeometry && cachedBaseMaterials) {
    return { geometry: cachedDieGeometry, materials: cachedBaseMaterials };
  }

  let materials: THREE.Material[];
  try {
    const loader = new THREE.TextureLoader();
    const textures = await Promise.all(
      [1, 2, 3, 4, 5, 6].map(n => loader.loadAsync(`/textures/face_${n}.png`))
    );

    const faceToMat = textures.map(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      // Make them shiny like real dice
      return new THREE.MeshPhysicalMaterial({ 
        map: tex,
        roughness: 0.15, 
        metalness: 0.05, 
        clearcoat: 0.6,
        clearcoatRoughness: 0.15
      });
    });

    // Arrange into slot order: slot i → material for FACE_ORDER[i]
    materials = FACE_ORDER.map(face => faceToMat[face - 1].clone());
  } catch {
    materials = createFallbackMaterials();
  }

  // Always use procedural rounded box for smooth edges instead of low-poly GLB
  const geometry = createRoundedBoxWithGroups(0.5, 0.08, 6);

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
  
  const highlightMat = getHighlightMaterial();
  const highlightGeo = new THREE.PlaneGeometry(0.8, 0.8);

  for (let i = 0; i < count; i++) {
    const clonedMats = materials.map(m => m.clone());
    const mesh = new THREE.Mesh(geometry, clonedMats);
    mesh.castShadow = true;
    mesh.userData.meshIndex = i;
    scene.add(mesh);

    const highlightMesh = new THREE.Mesh(highlightGeo, highlightMat);
    highlightMesh.rotation.x = -Math.PI / 2;
    highlightMesh.visible = false;
    scene.add(highlightMesh);

    const shape = new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25));
    const body = new CANNON.Body({ mass: 1, shape });
    body.position.set((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4);
    world.addBody(body);

    entries.push({ mesh, body, baseMaterials: clonedMats, highlightMesh });
  }

  return entries;
}

export function syncMeshesToBodies(entries: DiceMeshEntry[]): void {
  for (const { mesh, body, highlightMesh } of entries) {
    mesh.position.copy(body.position as unknown as THREE.Vector3);
    mesh.quaternion.copy(body.quaternion as unknown as THREE.Quaternion);
    if (highlightMesh) {
      highlightMesh.position.set(mesh.position.x, 0.015, mesh.position.z);
    }
  }
}

export function removeDiceFromScene(
  entries: DiceMeshEntry[],
  scene: THREE.Scene,
  world: CANNON.World,
): void {
  for (const { mesh, body, highlightMesh } of entries) {
    scene.remove(mesh);
    world.removeBody(body);
    if (highlightMesh) {
      scene.remove(highlightMesh);
    }
  }
}
