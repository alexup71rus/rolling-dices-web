// src/game/scoring.test.ts
import { describe, expect, it } from 'vitest';
import { detectCombinations, scoreCombinations } from './scoring';

describe('detectCombinations', () => {
  it('detects single 1', () => {
    const result = detectCombinations([1, 2, 3, 4]);
    expect(result).toContainEqual({ type: 'single', face: 1, diceIndices: [0], points: 100 });
  });

  it('detects single 5', () => {
    const result = detectCombinations([5, 2, 3, 4]);
    expect(result).toContainEqual({ type: 'single', face: 5, diceIndices: [0], points: 50 });
  });

  it('detects three-of-a-kind for 1s → 1000pts', () => {
    const result = detectCombinations([1, 1, 1, 4]);
    expect(result).toContainEqual({ type: 'triple', face: 1, diceIndices: [0, 1, 2], points: 1000 });
  });

  it('detects three-of-a-kind for 2s → 200pts', () => {
    const result = detectCombinations([2, 2, 2, 4]);
    expect(result).toContainEqual({ type: 'triple', face: 2, diceIndices: [0, 1, 2], points: 200 });
  });

  it('detects three-of-a-kind for 3s → 300pts', () => {
    const result = detectCombinations([3, 3, 3, 4]);
    expect(result).toContainEqual({ type: 'triple', face: 3, diceIndices: [0, 1, 2], points: 300 });
  });

  it('detects three-of-a-kind for 4s → 400pts', () => {
    const result = detectCombinations([4, 4, 4, 2]);
    expect(result).toContainEqual({ type: 'triple', face: 4, diceIndices: [0, 1, 2], points: 400 });
  });

  it('detects three-of-a-kind for 5s → 500pts', () => {
    const result = detectCombinations([5, 5, 5, 2]);
    expect(result).toContainEqual({ type: 'triple', face: 5, diceIndices: [0, 1, 2], points: 500 });
  });

  it('detects three-of-a-kind for 6s → 600pts', () => {
    const result = detectCombinations([6, 6, 6, 2]);
    expect(result).toContainEqual({ type: 'triple', face: 6, diceIndices: [0, 1, 2], points: 600 });
  });

  it('detects straight 1-2-3-4-5 → 1500pts', () => {
    const result = detectCombinations([1, 2, 3, 4, 5]);
    expect(result).toContainEqual({
      type: 'straight',
      diceIndices: [0, 1, 2, 3, 4],
      points: 1500,
    });
  });

  it('straight + extra scoring die: [1,2,3,4,5,1] → straight + single 1', () => {
    const result = detectCombinations([1, 2, 3, 4, 5, 1]);
    expect(result).toContainEqual({ type: 'straight', diceIndices: [0, 1, 2, 3, 4], points: 1500 });
    expect(result).toContainEqual({ type: 'single', face: 1, diceIndices: [5], points: 100 });
  });

  it('returns empty array for non-scoring roll', () => {
    expect(detectCombinations([2, 3, 4, 6])).toEqual([]);
  });

  it('no die appears in more than one combination', () => {
    const result = detectCombinations([1, 1, 1, 5]);
    const allIndices = result.flatMap(c => c.diceIndices);
    const unique = new Set(allIndices);
    expect(unique.size).toBe(allIndices.length);
  });

  it('greedy: [1,1,2,3,4,5] → straight(1500) + single 1(100), not six singles', () => {
    const result = detectCombinations([1, 1, 2, 3, 4, 5]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(1600);
    expect(result.some(c => c.type === 'straight')).toBe(true);
  });

  it('four 1s: scored as triple(1000) + single 1(100)', () => {
    const result = detectCombinations([1, 1, 1, 1]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(1100);
  });
});

describe('scoreCombinations', () => {
  it('sums points across all combinations', () => {
    const combos = [
      { type: 'single' as const, face: 1, diceIndices: [0], points: 100 },
      { type: 'triple' as const, face: 5, diceIndices: [1, 2, 3], points: 500 },
    ];
    expect(scoreCombinations(combos)).toBe(600);
  });

  it('returns 0 for empty', () => {
    expect(scoreCombinations([])).toBe(0);
  });
});
