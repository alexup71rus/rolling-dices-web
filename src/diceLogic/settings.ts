import * as CANNON from "cannon-es";

export const sceneSettings = {
  backgroundColor: 0x87ceeb,
  camera: {
    fov: 40,
    near: 0.1,
    far: 3000,
    position: { x: 0.3, y: 20, z: 5 },
    lookAt: { x: 0, y: 0, z: 0 },
  },
  light: {
    color: 0xffffff,
    intensity: 1,
    position: { x: 3, y: 10, z: 5 },
  },
  ambientLight: {
    color: 0xffffff,
    intensity: 0.3,
  },
  plane: {
    width: 13,
    height: 13,
    color: 0x592c0c,
    rotationX: -Math.PI / 2,
  },
  physics: {
    gravity: new CANNON.Vec3(0, -20.82, 0),
    restitution: 0.2,
    friction: 0.4,
    contactEquationStiffness: 1e9,
  },
};

export const diceSettings = {
  numberOfDice: 6, // Количество кубиков на доске
  impulseStrength: 5, // Сила импульса
  torqueStrength: 2, // Сила крутящего момента
  selectedEmissive: 0xaaaaaa, // Цвет выделения
  defaultEmissive: 0x000000, // Цвет по умолчанию
};
