import * as THREE from 'three';
import * as CANNON from 'cannon-es';

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
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 3000);
  camera.position.set(0, 24, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(3, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.bias = -0.0001;
  scene.add(dirLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  try {
    const canvasTexture = document.createElement('canvas');
    canvasTexture.width = 2048;
    canvasTexture.height = 2048;
    const context = canvasTexture.getContext('2d');
    if (context) {
      // Base dark wood grain
      context.fillStyle = '#4a2c11';
      context.fillRect(0, 0, 2048, 2048);
      
      // Draw procedural wood grain
      for (let i = 0; i < 2000; i++) {
        context.fillStyle = Math.random() > 0.5 ? 'rgba(40, 20, 10, 0.15)' : 'rgba(80, 45, 20, 0.1)';
        const y = Math.random() * 2048;
        const h = Math.random() * 10 + 2;
        context.fillRect(0, y, 2048, h);
        
        // Add waving effect to grain
        if (i % 5 === 0) {
           context.fillStyle = 'rgba(30, 15, 5, 0.05)';
           context.beginPath();
           context.ellipse(Math.random() * 2048, y, Math.random() * 300 + 50, h * 3, 0, 0, Math.PI * 2);
           context.fill();
        }
      }
      
      // Add imperfections and scratches (щербины)
      for (let i = 0; i < 300; i++) {
        const isDeep = Math.random() > 0.8;
        context.fillStyle = isDeep ? 'rgba(20, 10, 2, 0.5)' : 'rgba(35, 18, 8, 0.3)';
        const x = Math.random() * 2048;
        const y = Math.random() * 2048;
        const w = (Math.random() * 2 + 1) * (isDeep ? 2 : 1);
        const h = Math.random() * 15 + 5;
        
        context.save();
        context.translate(x, y);
        context.rotate((Math.random() - 0.5) * 0.5);
        context.fillRect(0, 0, w, h);
        context.restore();
      }
    }
    
    // Create color texture
    const woodTexture = new THREE.CanvasTexture(canvasTexture);
    woodTexture.colorSpace = THREE.SRGBColorSpace;
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(1, 1);
    
    // Create a bump map from the same canvas but slightly altered (for depth)
    const bumpTexture = new THREE.CanvasTexture(canvasTexture);
    bumpTexture.wrapS = THREE.RepeatWrapping;
    bumpTexture.wrapT = THREE.RepeatWrapping;
    bumpTexture.repeat.set(1, 1);

    const planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14), // Сделал доску размером чуть больше области броска
      new THREE.MeshPhysicalMaterial({
        map: woodTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.015,
        roughness: 0.85,
        metalness: 0.05,
        clearcoat: 0.05,
      }),
    );
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.receiveShadow = true;
    scene.add(planeMesh);

    // Добавляем бортики для доски
    const borderMat = new THREE.MeshPhysicalMaterial({
      map: woodTexture, // используем ту же текстуру дерева
      bumpMap: bumpTexture,
      bumpScale: 0.01,
      roughness: 0.9,
      color: 0x8b5a2b, // чуть затемним
      clearcoat: 0.1
    });

    const tbGeo = new THREE.BoxGeometry(14, 0.6, 0.5); // top/bottom borders
    const lrGeo = new THREE.BoxGeometry(0.5, 0.6, 13); // left/right borders

    const borders = [
      { geo: tbGeo, pos: [0, 0.3, -6.75] },
      { geo: tbGeo, pos: [0, 0.3, 6.75] },
      { geo: lrGeo, pos: [-6.75, 0.3, 0] },
      { geo: lrGeo, pos: [6.75, 0.3, 0] },
    ];

    borders.forEach(b => {
      const borderMesh = new THREE.Mesh(b.geo, borderMat);
      borderMesh.position.set(b.pos[0] as number, b.pos[1] as number, b.pos[2] as number);
      borderMesh.receiveShadow = true;
      borderMesh.castShadow = true;
      scene.add(borderMesh);
    });

  } catch (err) {
    console.error(err);
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
