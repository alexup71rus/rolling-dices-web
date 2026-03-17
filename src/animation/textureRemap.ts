import type * as THREE from 'three';
import { FACE_ORDER } from '../scene/DiceRenderer';

/**
 * Builds a remapped copy of `materials` so that the slot which
 * naturally shows `animFinalFace` in the animation now shows
 * `desiredFace` instead. Does not mutate the input array.
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

  if (animSlot === -1 || desiredSlot === -1) return result;

  [result[animSlot], result[desiredSlot]] = [result[desiredSlot], result[animSlot]];
  return result;
}
