// diceLogic/diceLogic.ts
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { sceneSettings, diceSettings } from "./settings";
import { createWalls } from "./walls";
import { createDice, rigDiceToFace, getRolledFace } from "./dice";

export function initSceneWrapper(
  canvas: HTMLCanvasElement,
  options?: { onDiceClick?: (index: number, value: number) => void },
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(sceneSettings.backgroundColor);

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
    canvas,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  // Свет
  const light = new THREE.DirectionalLight(
    sceneSettings.light.color,
    sceneSettings.light.intensity,
  );
  light.castShadow = true;
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
  const planeMat = new THREE.MeshPhongMaterial({
    color: sceneSettings.plane.color,
  });
  const planeMesh = new THREE.Mesh(planeGeo, planeMat);
  planeMesh.rotation.x = sceneSettings.plane.rotationX;
  planeMesh.receiveShadow = true;
  scene.add(planeMesh);

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
        const setEmissiveColor = (mesh: THREE.Mesh, color: number) => {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => {
              (mat as THREE.MeshPhongMaterial).emissive.set(color);
            });
          } else {
            (mesh.material as THREE.MeshPhongMaterial).emissive.set(color);
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

    dice.forEach((die, index) => {
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
