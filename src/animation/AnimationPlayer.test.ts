import { describe, expect, it } from 'vitest';
import { interpolateFrame } from './AnimationPlayer';
import type { AnimationFrame } from './animationLibrary';

describe('interpolateFrame', () => {
  const frame0: AnimationFrame = {
    t: 0,
    dice: [{ px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }],
  };
  const frame1: AnimationFrame = {
    t: 1,
    dice: [{ px: 10, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 }],
  };

  it('returns frame0 values at t=0', () => {
    const result = interpolateFrame([frame0, frame1], 0);
    expect(result[0].px).toBeCloseTo(0);
  });

  it('returns frame1 values at t=1', () => {
    const result = interpolateFrame([frame0, frame1], 1);
    expect(result[0].px).toBeCloseTo(10);
  });

  it('linearly interpolates position at t=0.5', () => {
    const result = interpolateFrame([frame0, frame1], 0.5);
    expect(result[0].px).toBeCloseTo(5);
  });

  it('clamps to first frame before t=0', () => {
    const result = interpolateFrame([frame0, frame1], -1);
    expect(result[0].px).toBeCloseTo(0);
  });

  it('clamps to last frame after t=duration', () => {
    const result = interpolateFrame([frame0, frame1], 5);
    expect(result[0].px).toBeCloseTo(10);
  });

  it('returns empty array for empty frames', () => {
    expect(interpolateFrame([], 0.5)).toEqual([]);
  });

  it('returns single frame values when only one frame', () => {
    const result = interpolateFrame([frame0], 0.5);
    expect(result[0].px).toBeCloseTo(0);
  });

  it('interpolates multiple dice independently', () => {
    const f0: AnimationFrame = {
      t: 0,
      dice: [
        { px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { px: 10, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      ],
    };
    const f1: AnimationFrame = {
      t: 1,
      dice: [
        { px: 10, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
        { px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      ],
    };
    const result = interpolateFrame([f0, f1], 0.5);
    expect(result).toHaveLength(2);
    expect(result[0].px).toBeCloseTo(5);
    expect(result[1].px).toBeCloseTo(5);
  });
});
