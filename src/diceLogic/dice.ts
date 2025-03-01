// diceLogic/dice.ts
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createFaceTexture } from "./textures";
import { diceSettings } from "./settings";

// Создание материалов для граней кубика
export function createDiceMaterials(): THREE.MeshPhongMaterial[] {
  const faceOrder = [2, 5, 1, 6, 3, 4];
  return faceOrder.map(
    (num) => new THREE.MeshPhongMaterial({ map: createFaceTexture(num) }),
  );
}

export const diceFaceNormals: { [face: number]: CANNON.Vec3 } = {
  1: new CANNON.Vec3(0, 1, 0),
  6: new CANNON.Vec3(0, -1, 0),
  2: new CANNON.Vec3(1, 0, 0),
  5: new CANNON.Vec3(-1, 0, 0),
  3: new CANNON.Vec3(0, 0, 1),
  4: new CANNON.Vec3(0, 0, -1),
};

export const adjacentFacesDice: { [face: number]: number[] } = {
  1: [2, 3, 4, 5],
  2: [1, 3, 6, 4],
  3: [1, 2, 6, 5],
  4: [1, 5, 6, 2],
  5: [1, 4, 6, 3],
  6: [2, 3, 4, 5],
};

// Определяем, какая грань кубика выпала
export function getRolledFace(body: CANNON.Body): number {
  const faces = Object.entries(diceFaceNormals).map(([id, normal]) => ({
    id: Number(id),
    normal,
  }));

  if (
    body.velocity.lengthSquared() > 0.01 ||
    body.angularVelocity.lengthSquared() > 0.01
  ) {
    return -1;
  }

  let bestFace = { id: 0, dot: -Infinity };
  const upVector = new CANNON.Vec3(0, 1, 0);
  for (const face of faces) {
    const worldNormal = body.quaternion.vmult(face.normal);
    const dot = worldNormal.dot(upVector);
    if (dot > bestFace.dot) {
      bestFace = { id: face.id, dot };
    }
  }
  return bestFace.id;
}

// Переворачиваем кубик к нужной грани
export function rigDiceToFace(
  dice: { body: CANNON.Body; mesh: THREE.Mesh; selected?: boolean }[],
  specialDiceSettings: { face: number; attempts: number }[],
) {
  dice.forEach((diceItem, index) => {
    const body = diceItem.body;
    const specialDice = specialDiceSettings[index];

    if (!specialDice) return;

    let attempts = specialDice.attempts;
    const targetFace = specialDice.face;

    const interval = setInterval(() => {
      const currentFace = getRolledFace(body);
      if (currentFace === -1) return;
      if (
        body.velocity.lengthSquared() > 0.4 ||
        body.angularVelocity.lengthSquared() > 0.4
      ) {
        return;
      }
      if (attempts-- <= 0) {
        console.log(
          `Кубик ${index}: не удалось стабилизировать на нужной грани`,
        );
        clearInterval(interval);
        return;
      }
      if (currentFace === targetFace) {
        console.log(
          `Кубик ${index} стабилизировался на нужной грани ${targetFace}`,
        );
        clearInterval(interval);
        return;
      }
      const path = findFaceFlipPath(currentFace, targetFace);
      if (path.length < 2) {
        clearInterval(interval);
        return;
      }
      const fromFace = path[0];
      const nextFace = path[1];
      const { impulseVec, torqueVec } = computeFlipImpulseAndTorque(
        body,
        fromFace,
        nextFace,
      );
      console.log(
        `Кубик ${index}: переворачиваем с грани ${fromFace} на грань ${nextFace}. ` +
          `Импульс: [${impulseVec.x.toFixed(2)}, ${impulseVec.y.toFixed(2)}, ${impulseVec.z.toFixed(2)}], ` +
          `Крутящий момент: [${torqueVec.x.toFixed(2)}, ${torqueVec.y.toFixed(2)}, ${torqueVec.z.toFixed(2)}]`,
      );
      body.applyImpulse(impulseVec, body.position);
      body.angularVelocity.vadd(torqueVec, body.angularVelocity);
    }, 10);
  });
}

// Функция поиска пути переворота
function findFaceFlipPath(currentFace: number, targetFace: number): number[] {
  if (currentFace === targetFace) return [currentFace];
  const queue: number[][] = [[currentFace]];
  const visited = new Set<number>([currentFace]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const face = path[path.length - 1];
    const neighbors = adjacentFacesDice[face];
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      const newPath = path.concat(neighbor);
      if (neighbor === targetFace) return newPath;
      visited.add(neighbor);
      queue.push(newPath);
    }
  }
  return [];
}

// Вычисление импульса и крутящего момента для переворота
function computeFlipImpulseAndTorque(
  body: CANNON.Body,
  fromFace: number,
  toFace: number,
) {
  const localNormal = diceFaceNormals[toFace];
  const worldNormal = body.quaternion.vmult(localNormal, new CANNON.Vec3());
  const pushDir = new CANNON.Vec3(worldNormal.x, 0, worldNormal.z);
  pushDir.normalize();
  const fromNormal = body.quaternion.vmult(
    diceFaceNormals[fromFace],
    new CANNON.Vec3(),
  );
  const rotationAxis = fromNormal.cross(worldNormal, new CANNON.Vec3());
  rotationAxis.normalize();
  const impulseVec = pushDir.scale(diceSettings.impulseStrength);
  const torqueVec = rotationAxis.scale(diceSettings.torqueStrength);
  return { impulseVec, torqueVec };
}

// Создание кубиков
export function createDice(scene: THREE.Scene, world: CANNON.World) {
  const dice = [];
  const baseMaterials = createDiceMaterials();

  // Загружаем настройки особых кубиков
  const specialDiceSettings = JSON.parse(
    localStorage.getItem("specialDiceSettings") || "[]",
  );

  for (let i = 0; i < diceSettings.numberOfDice; i++) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    let materials = baseMaterials.map((mat, index) => {
      return mat.clone(); // По умолчанию копируем стандартные материалы с текстурами
    });

    // Проверяем, есть ли настройки для этого кубика
    const specialDice = specialDiceSettings[i];
    if (specialDice) {
      let baseColor: number | null = null;

      if (specialDice.attempts <= 5) {
        baseColor = 0xba7824; // Бронзовый (коричневатый)
      } else if (specialDice.attempts <= 15) {
        baseColor = 0xb3b9c7; // Серебряный (серый)
      }

      if (baseColor !== null) {
        // Создаем материалы с цветом + текстурами
        materials = baseMaterials.map(
          (mat) =>
            new THREE.MeshPhongMaterial({
              color: baseColor, // Цвет (бронза/серебро)
              map: mat.map, // Сохранение текстуры номера
            }),
        );
      }
    }

    const mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow = true;
    mesh.userData.diceIndex = i;
    scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
    const body = new CANNON.Body({ mass: 1, shape });
    body.position.set((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4);
    world.addBody(body);

    dice.push({ mesh, body, selected: false });
  }
  return dice;
}
