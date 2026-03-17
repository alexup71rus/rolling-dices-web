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
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 3000);
  camera.position.set(0.3, 20, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

  const world = new CANNON.World();
  world.gravity.set(0, -20.82, 0);
  world.defaultContactMaterial.restitution = 0.2;
  world.defaultContactMaterial.friction = 0.4;
  world.defaultContactMaterial.contactEquationStiffness = 1e9;

  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);
  world.addBody(groundBody);

  const wallPositions: Array<{ pos: [number, number, number]; rot: [number, number, number] }> = [
    { pos: [0, 1, -6.5], rot: [0, 0, 0] },
    { pos: [0, 1, 6.5], rot: [Math.PI, 0, 0] },
    { pos: [-6.5, 1, 0], rot: [0, Math.PI / 2, 0] },
    { pos: [6.5, 1, 0], rot: [0, -Math.PI / 2, 0] },
  ];
  for (const { pos, rot } of wallPositions) {
    const wallBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    wallBody.position.set(...pos);
    wallBody.quaternion.setFromEuler(...rot);
    world.addBody(wallBody);
  }

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
