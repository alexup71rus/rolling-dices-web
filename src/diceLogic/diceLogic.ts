// diceLogic/diceLogic.ts
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { sceneSettings } from "./settings";
import { createWalls } from "./walls";
import { createDice, getRolledFace, rigDiceToFace } from "./dice";

export function initSceneWrapper(
  canvas: HTMLCanvasElement,
  options?: { onDiceClick?: (index: number, value: number) => void },
) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    sceneSettings.camera.fov,
    window.innerWidth / window.innerHeight,
    sceneSettings.camera.near,
    sceneSettings.camera.far,
  );
  camera.position.set(
    sceneSettings.camera.position.x,
    sceneSettings.camera.position.y,
    sceneSettings.camera.position.z,
  );
  camera.lookAt(
    sceneSettings.camera.lookAt.x,
    sceneSettings.camera.lookAt.y,
    sceneSettings.camera.lookAt.z,
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Свет
  const light = new THREE.DirectionalLight(
    sceneSettings.light.color,
    sceneSettings.light.intensity * 1.5,
  );
  light.castShadow = true;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;
  light.shadow.bias = -0.0001;
  light.position.set(
    sceneSettings.light.position.x,
    sceneSettings.light.position.y,
    sceneSettings.light.position.z,
  );
  scene.add(light);
  const ambient = new THREE.AmbientLight(
    sceneSettings.ambientLight.color,
    sceneSettings.ambientLight.intensity,
  );
  scene.add(ambient);

  // Плоскость
  const planeGeo = new THREE.PlaneGeometry(
    sceneSettings.plane.width,
    sceneSettings.plane.height,
  );
  
  const canvasTexture = document.createElement('canvas');
  canvasTexture.width = 2048;
  canvasTexture.height = 2048;
  const context = canvasTexture.getContext('2d');
  if (context) {
    context.fillStyle = '#4a2c11';
    context.fillRect(0, 0, 2048, 2048);
    for (let i = 0; i < 2000; i++) {
      context.fillStyle = Math.random() > 0.5 ? 'rgba(40, 20, 10, 0.15)' : 'rgba(80, 45, 20, 0.1)';
      const y = Math.random() * 2048;
      const h = Math.random() * 10 + 2;
      context.fillRect(0, y, 2048, h);
      if (i % 5 === 0) {
         context.fillStyle = 'rgba(30, 15, 5, 0.05)';
         context.beginPath();
         context.ellipse(Math.random() * 2048, y, Math.random() * 300 + 50, h * 3, 0, 0, Math.PI * 2);
         context.fill();
      }
    }
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
  
  const woodTexture = new THREE.CanvasTexture(canvasTexture);
  woodTexture.colorSpace = THREE.SRGBColorSpace;
  woodTexture.wrapS = THREE.RepeatWrapping;
  woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(1, 1);
  
  const bumpTexture = new THREE.CanvasTexture(canvasTexture);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.repeat.set(1, 1);

  const planeMat = new THREE.MeshPhysicalMaterial({
    map: woodTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.015,
    roughness: 0.85,
    metalness: 0.05,
    clearcoat: 0.05,
  });
  const planeMesh = new THREE.Mesh(planeGeo, planeMat);
  planeMesh.rotation.x = sceneSettings.plane.rotationX;
  planeMesh.receiveShadow = true;
  scene.add(planeMesh);

  // Добавляем бортики
  const borderMat = new THREE.MeshPhysicalMaterial({
    map: woodTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.01,
    roughness: 0.9,
    color: 0x8b5a2b,
    clearcoat: 0.1
  });

  const tbGeo = new THREE.BoxGeometry(sceneSettings.plane.width, 0.6, 0.5);
  const lrGeo = new THREE.BoxGeometry(0.5, 0.6, sceneSettings.plane.height - 0.5);
  const bw = sceneSettings.plane.width / 2;
  const bh = sceneSettings.plane.height / 2;

  const borders = [
    { geo: tbGeo, pos: [0, 0.3, -bh + 0.25] },
    { geo: tbGeo, pos: [0, 0.3, bh - 0.25] },
    { geo: lrGeo, pos: [-bw + 0.25, 0.3, 0] },
    { geo: lrGeo, pos: [bw - 0.25, 0.3, 0] },
  ];

  borders.forEach(b => {
    const borderMesh = new THREE.Mesh(b.geo, borderMat);
    borderMesh.position.set(b.pos[0] as number, b.pos[1] as number, b.pos[2] as number);
    borderMesh.receiveShadow = true;
    borderMesh.castShadow = true;
    scene.add(borderMesh);
  });

  // Физический мир
  const world = new CANNON.World();
  world.gravity.copy(sceneSettings.physics.gravity);
  world.defaultContactMaterial.restitution = sceneSettings.physics.restitution;
  world.defaultContactMaterial.friction = sceneSettings.physics.friction;
  world.defaultContactMaterial.contactEquationStiffness =
    sceneSettings.physics.contactEquationStiffness;

  const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
  groundBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1, 0, 0),
    Math.PI / 2,
  );
  world.addBody(groundBody);

  // Добавляем стены и кубики
  createWalls(scene, world);
  const dice = createDice(scene, world);

  // Обработка кликов по кубикам
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(
      dice.map((d) => d.mesh),
      true,
    );
    if (intersects.length > 0) {
      let clickedMesh = intersects[0].object;
      let diceIndex = dice.findIndex((d) => d.mesh === clickedMesh);
      if (diceIndex === -1 && clickedMesh.parent) {
        clickedMesh = clickedMesh.parent;
        diceIndex = dice.findIndex((d) => d.mesh === clickedMesh);
      }
      if (diceIndex >= 0) {
        const diceItem = dice[diceIndex];
        diceItem.selected = !diceItem.selected;
        console.log(`Кубик ${diceIndex}: selected = ${diceItem.selected}`);
        // Изменяем emissive у материалов
        const setEmissiveColor = (object: THREE.Object3D, color: number) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }

          if (Array.isArray(object.material)) {
            object.material.forEach((mat: any) => {
              if (mat.emissive) {
                mat.emissive.set(color);
              }
            });
          } else if ((object.material as any).emissive) {
            (object.material as any).emissive.set(color);
          }
        };
        if (diceItem.selected) {
          setEmissiveColor(clickedMesh, 0xaaaaaa);
        } else {
          setEmissiveColor(clickedMesh, 0x000000);
        }
        const rolledFace = getRolledFace(diceItem.body);
        options?.onDiceClick?.(diceIndex, rolledFace);
      }
    }
  });

  function animate() {
    requestAnimationFrame(animate);
    world.step(1 / 60);
    dice.forEach(({ body, mesh }) => {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    });
    renderer.render(scene, camera);
  }
  animate();

  // Функция броска кубиков
  function rollAllDice() {
    // Загружаем настройки особых кубиков
    const specialDiceSettings = JSON.parse(
      localStorage.getItem("specialDiceSettings") || "[]",
    );

    dice.forEach((die) => {
      die.body.position.set(
        (Math.random() - 0.5) * 4,
        5,
        (Math.random() - 0.5) * 4,
      );
      die.body.velocity.set(
        (Math.random() - 0.5) * 10,
        5 + Math.random() * 5,
        (Math.random() - 0.5) * 10,
      );
      die.body.angularVelocity.set(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
      );
    });

    rigDiceToFace(dice, specialDiceSettings);
  }

  // Функция отложения выбранных кубиков
  function setAsideSelectedDice() {
    const setAsideValues: number[] = [];
    dice.forEach((diceItem) => {
      if (diceItem.selected) {
        const value = getRolledFace(diceItem.body);
        setAsideValues.push(value);
        scene.remove(diceItem.mesh);
        world.removeBody(diceItem.body);
      }
    });
    return setAsideValues;
  }

  return { rollAllDice, setAsideSelectedDice };
}
