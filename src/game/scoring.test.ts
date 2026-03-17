import { describe, expect, it } from 'vitest';
import { detectCombinations, isHotDice, isFarkle, scoreCombinations } from './scoring';

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

  it('six 5s: two triples → 1000pts total', () => {
    const result = detectCombinations([5, 5, 5, 5, 5, 5]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(1000);
    expect(result.filter(c => c.type === 'triple')).toHaveLength(2);
  });

  it('empty array → no combinations', () => {
    expect(detectCombinations([])).toEqual([]);
  });

  it('single die [1] → single 1 (100pts)', () => {
    const result = detectCombinations([1]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'single', face: 1, points: 100 });
  });

  it('single die [5] → single 5 (50pts)', () => {
    const result = detectCombinations([5]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'single', face: 5, points: 50 });
  });

  it('single die [3] → no scoring', () => {
    expect(detectCombinations([3])).toEqual([]);
  });

  it('[1, 5] → single 1 + single 5 (150pts)', () => {
    const result = detectCombinations([1, 5]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(150);
    expect(result).toHaveLength(2);
  });

  it('[2, 3, 4, 5, 6] is NOT a straight → only single 5 (50pts)', () => {
    const result = detectCombinations([2, 3, 4, 5, 6]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(50);
    expect(result.every(c => c.type !== 'straight')).toBe(true);
  });

  it('[1, 1, 1, 1, 1] → triple(1000) + two singles(200) = 1200pts', () => {
    const result = detectCombinations([1, 1, 1, 1, 1]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(1200);
  });

  it('[2, 2, 2, 2, 2, 2] → two triples of 2 = 400pts', () => {
    const result = detectCombinations([2, 2, 2, 2, 2, 2]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(400);
    expect(result.filter(c => c.type === 'triple')).toHaveLength(2);
  });

  it('[1, 2, 3, 4, 5, 6] → straight(1500) + single 6? No, 6 is not scoring, only straight', () => {
    const result = detectCombinations([1, 2, 3, 4, 5, 6]);
    const total = result.reduce((s, c) => s + c.points, 0);
    expect(total).toBe(1500);
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

describe('isFarkle', () => {
  it('returns true when no scoring combinations', () => {
    expect(isFarkle([2, 3, 4, 6])).toBe(true);
  });

  it('returns false when single 1 present', () => {
    expect(isFarkle([1, 2, 3, 4])).toBe(false);
  });

  it('returns false when triple present', () => {
    expect(isFarkle([2, 2, 2, 4])).toBe(false);
  });
});

describe('isHotDice', () => {
  it('returns true when all active dice are in scoring combos', () => {
    expect(isHotDice([1, 1, 1, 5, 5, 5], [0, 1, 2, 3, 4, 5])).toBe(true);
  });

  it('returns false when some active dice are non-scoring', () => {
    expect(isHotDice([1, 2, 3, 4], [0, 1, 2, 3])).toBe(false);
  });

  it('vacuously true for empty activeIndices', () => {
    expect(isHotDice([], [])).toBe(true);
  });

  it('uses precomputedCombos when provided', () => {
    // Pass wrong combos — should trust them, not recompute
    const fakeCombos = [{ type: 'single' as const, face: 1, diceIndices: [0, 1, 2, 3], points: 100 }];
    expect(isHotDice([2, 3, 4, 6], [0, 1, 2, 3], fakeCombos)).toBe(true);
  });
});
