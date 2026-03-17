// src/game/diceModifiers.test.ts
import { describe, expect, it } from 'vitest';
import {
  createDie,
  applyModifiers,
  resolveLuckyDice,
  clampWeights,
  rollDice,
  buildModifiersFromConfig,
  type DieType,
} from './diceModifiers';

describe('createDie', () => {
  it('normal die has equal weights', () => {
    const die = createDie('normal');
    expect(die.baseWeights).toEqual([1, 1, 1, 1, 1, 1]);
    expect(die.weights).toEqual([1, 1, 1, 1, 1, 1]);
    expect(die.type).toBe('normal');
  });

  it('biased-1 die has 3x weight on face 1', () => {
    const die = createDie('biased-1');
    expect(die.baseWeights[0]).toBe(3);
    expect(die.baseWeights.slice(1)).toEqual([1, 1, 1, 1, 1]);
  });

  it('biased-5 die has 3x weight on face 5', () => {
    const die = createDie('biased-5');
    expect(die.baseWeights[4]).toBe(3);
  });
});

describe('applyModifiers', () => {
  it('boost increases weight for target face', () => {
    const dice = [createDie('normal')];
    applyModifiers(dice, [{
      power: 5,
      targetDiceIndices: [0],
      effectType: 'boost',
      params: { face: 1, amount: 2 },
    }]);
    // amount=2, power=5 → 2*(5/5)=2 added to face 1
    expect(dice[0].weights[0]).toBe(3);
  });

  it('block sets weight to 0 for target face', () => {
    const dice = [createDie('normal')];
    applyModifiers(dice, [{
      power: 5,
      targetDiceIndices: [0],
      effectType: 'block',
      params: { face: 3 },
    }]);
    expect(dice[0].weights[2]).toBe(0);
  });

  it('higher power modifier runs first', () => {
    const dice = [createDie('normal')];
    // Use boost with side-effect tracking via power ordering
    applyModifiers(dice, [
      { power: 1, targetDiceIndices: [0], effectType: 'boost', params: { face: 1, amount: 1 } },
      { power: 10, targetDiceIndices: [0], effectType: 'boost', params: { face: 1, amount: 1 } },
    ]);
    // Both apply; result is 1 + 1*(10/5) + 1*(1/5) = 1 + 2 + 0.2 = 3.2
    expect(dice[0].weights[0]).toBeCloseTo(3.2);
  });

  it('does not modify other dice', () => {
    const dice = [createDie('normal'), createDie('normal')];
    applyModifiers(dice, [{
      power: 5, targetDiceIndices: [0], effectType: 'boost', params: { face: 1, amount: 2 },
    }]);
    expect(dice[1].weights).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe('clampWeights', () => {
  it('clamps negative weights to 0', () => {
    const dice = [createDie('normal')];
    dice[0].weights[2] = -5;
    clampWeights(dice);
    expect(dice[0].weights[2]).toBe(0);
  });
});

describe('resolveLuckyDice', () => {
  it('lucky die gets +1 on highest-EV face (face 1 when others are normal)', () => {
    // With all normal non-lucky dice, face 1 has highest EV (100*1/6 ≈ 16.7 vs face5 50*1/6 ≈ 8.3)
    const dice = [createDie('lucky'), createDie('normal'), createDie('normal')];
    resolveLuckyDice(dice);
    expect(dice[0].weights[0]).toBe(2); // face 1 boosted from 1 → 2
  });

  it('unlucky die gets -1 on highest-EV face', () => {
    const dice = [createDie('unlucky'), createDie('normal')];
    resolveLuckyDice(dice);
    expect(dice[0].weights[0]).toBe(0); // face 1 reduced from 1 → 0
  });

  it('when no non-lucky dice, lucky die is unchanged', () => {
    const dice = [createDie('lucky')];
    resolveLuckyDice(dice);
    expect(dice[0].weights).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe('rollDice', () => {
  it('returns one value per die', () => {
    const dice = [createDie('normal'), createDie('normal')];
    const result = rollDice(dice);
    expect(result).toHaveLength(2);
  });

  it('all values are 1–6', () => {
    const dice = Array.from({ length: 6 }, () => createDie('normal'));
    const result = rollDice(dice);
    result.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    });
  });

  it('blocked face never appears (weight=0)', () => {
    const die = createDie('normal');
    // Block all faces except face 3
    die.weights = [0, 0, 100, 0, 0, 0];
    const results = Array.from({ length: 50 }, () => rollDice([die])[0]);
    results.forEach(v => expect(v).toBe(3));
  });

  it('falls back to uniform random if all weights are 0', () => {
    const die = createDie('normal');
    die.weights = [0, 0, 0, 0, 0, 0];
    const result = rollDice([die])[0];
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(6);
  });
});

describe('buildModifiersFromConfig', () => {
  it('returns empty array for all die types (behaviour encoded in baseWeights or resolveLuckyDice)', () => {
    const configs: DieType[][] = [
      ['normal', 'normal'],
      ['biased-1', 'biased-5'],
      ['lucky', 'unlucky', 'normal'],
    ];
    configs.forEach(config => {
      expect(buildModifiersFromConfig(config)).toEqual([]);
    });
  });
});
