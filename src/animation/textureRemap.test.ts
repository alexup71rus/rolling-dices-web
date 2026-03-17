import { describe, expect, it } from 'vitest';
import { buildRemappedMaterials } from './textureRemap';

// Mock materials (just objects with an id for identity testing)
const makeMats = () => [0, 1, 2, 3, 4, 5].map(i => ({ id: i }) as any);

describe('buildRemappedMaterials', () => {
  it('returns 6 materials', () => {
    const mats = makeMats();
    const result = buildRemappedMaterials(mats, 3, 1);
    expect(result).toHaveLength(6);
  });

  it('swaps so that animFinalFace slot now holds desiredFace material', () => {
    // FACE_ORDER = [2, 5, 1, 6, 3, 4]
    // animFinalFace=3 → slot 4 (FACE_ORDER[4]=3)
    // desiredFace=1  → lives at slot 2 (FACE_ORDER[2]=1)
    // After remap: slot 4 should contain what was at slot 2
    const mats = makeMats();
    const original = [...mats];
    const result = buildRemappedMaterials(mats, 3, 1);
    expect(result[4]).toBe(original[2]);
  });

  it('when animFinalFace === desiredFace, materials are unchanged', () => {
    const mats = makeMats();
    const result = buildRemappedMaterials(mats, 3, 3);
    result.forEach((m, i) => expect(m).toBe(mats[i]));
  });

  it('does not mutate the input array', () => {
    const mats = makeMats();
    const original = [...mats];
    buildRemappedMaterials(mats, 3, 1);
    mats.forEach((m, i) => expect(m).toBe(original[i]));
  });
});
