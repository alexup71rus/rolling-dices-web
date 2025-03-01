// diceLogic/walls.ts
import * as THREE from "three";
import * as CANNON from "cannon-es";

export function createWalls(scene: THREE.Scene, world: CANNON.World) {
  const wallSize = { width: 13, height: 8, depth: 0.3 };
  const positions = [
    { x: 0, y: 4, z: 6.4 },
    { x: 0, y: 4, z: -6.4 },
    { x: 6.4, y: 4, z: 0, rotY: Math.PI / 2 },
    { x: -6.4, y: 4, z: 0, rotY: Math.PI / 2 },
  ];
  const material = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
  positions.forEach(({ x, y, z, rotY = 0 }) => {
    const geo = new THREE.BoxGeometry(
      wallSize.width,
      wallSize.height,
      wallSize.depth,
    );
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.rotation.y = rotY;
    scene.add(mesh);
    const shape = new CANNON.Box(
      new CANNON.Vec3(
        wallSize.width / 2,
        wallSize.height / 2,
        wallSize.depth / 2,
      ),
    );
    const body = new CANNON.Body({ mass: 0, shape });
    body.position.set(x, y, z);
    body.quaternion.setFromEuler(0, rotY, 0);
    world.addBody(body);
  });
}
