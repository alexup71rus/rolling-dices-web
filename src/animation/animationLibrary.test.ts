// src/animation/animationLibrary.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadManifest, pickAnimation, clearManifestCache, type AnimationData } from './animationLibrary';

const MOCK_ANIM: AnimationData = {
  diceCount: 2,
  duration: 2.5,
  finalFaces: [3, 5],
  frames: [{ t: 0, dice: [{ px: 0, py: 5, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }, { px: 1, py: 5, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }] }],
};

beforeEach(() => {
  vi.restoreAllMocks();
  clearManifestCache();
});

describe('loadManifest', () => {
  it('returns parsed manifest object', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ '2d': ['anim_2d_001.json'] }),
    } as any);
    const manifest = await loadManifest();
    expect(manifest['2d']).toContain('anim_2d_001.json');
  });
});

describe('pickAnimation', () => {
  it('returns animation data for existing dice count', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ '2d': ['anim_2d_001.json'] }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_ANIM } as any);
    const anim = await pickAnimation(2);
    expect(anim.diceCount).toBe(2);
    expect(anim.finalFaces).toHaveLength(2);
  });

  it('falls back to nearest smaller count if exact count missing', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ '1d': ['anim_1d_001.json'] }) } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...MOCK_ANIM, diceCount: 1, finalFaces: [3] }) } as any);
    const anim = await pickAnimation(3);
    expect(anim.diceCount).toBe(1);
  });

  it('throws if no animations exist at all', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as any);
    await expect(pickAnimation(2)).rejects.toThrow('No animations available');
  });
});
