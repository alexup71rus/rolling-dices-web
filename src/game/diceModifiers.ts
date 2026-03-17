// src/game/diceModifiers.ts

export type DieType = 'normal' | 'biased-1' | 'biased-5' | 'lucky' | 'unlucky';

export interface Die {
  baseWeights: number[];
  weights: number[];
  type: DieType;
}

export type Modifier =
  | { power: number; targetDiceIndices: number[]; effectType: 'boost'; params: { face: number; amount: number } }
  | { power: number; targetDiceIndices: number[]; effectType: 'block'; params: { face: number } };

const BASE_WEIGHTS: Record<DieType, number[]> = {
  'normal':   [1, 1, 1, 1, 1, 1],
  'biased-1': [3, 1, 1, 1, 1, 1],
  'biased-5': [1, 1, 1, 1, 3, 1],
  'lucky':    [1, 1, 1, 1, 1, 1],
  'unlucky':  [1, 1, 1, 1, 1, 1],
};

export function createDie(type: DieType): Die {
  const base = [...BASE_WEIGHTS[type]];
  return { baseWeights: base, weights: [...base], type };
}

export function resetWeights(dice: Die[]): void {
  dice.forEach(d => { d.weights = [...d.baseWeights]; });
}

export function applyModifiers(dice: Die[], modifiers: Modifier[]): void {
  const sorted = [...modifiers].sort((a, b) => b.power - a.power);
  for (const mod of sorted) {
    for (const idx of mod.targetDiceIndices) {
      const w = dice[idx].weights;
      if (mod.effectType === 'boost') {
        w[mod.params.face - 1] += mod.params.amount * (mod.power / 5);
      } else {
        w[mod.params.face - 1] = 0;
      }
    }
  }
}

export function clampWeights(dice: Die[]): void {
  dice.forEach(d => { d.weights = d.weights.map(w => Math.max(0, w)); });
}

/** Flat single-die EV: EV(face) = P(face) × singleDieScore(face) */
function getBestExpectedFace(pool: Die[]): number {
  if (pool.length === 0) return -1;
  const SINGLE_SCORE: Record<number, number> = { 1: 100, 5: 50 };
  let bestFace = 1;
  let bestEV = -Infinity;
  for (let face = 1; face <= 6; face++) {
    const score = SINGLE_SCORE[face] ?? 0;
    const avgP = pool.reduce((sum, d) => {
      const total = d.weights.reduce((a, b) => a + b, 0);
      return sum + (total > 0 ? d.weights[face - 1] / total : 1 / 6);
    }, 0) / pool.length;
    const ev = avgP * score;
    if (ev > bestEV) { bestEV = ev; bestFace = face; }
  }
  return bestFace;
}

export function resolveLuckyDice(dice: Die[]): void {
  const pool = dice.filter(d => d.type !== 'lucky' && d.type !== 'unlucky');
  const targetFace = getBestExpectedFace(pool);
  if (targetFace === -1) return;
  for (const die of dice) {
    if (die.type === 'lucky')   die.weights[targetFace - 1] += 1;
    if (die.type === 'unlucky') die.weights[targetFace - 1] -= 1;
  }
}

export function rollDice(dice: Die[]): number[] {
  return dice.map(die => {
    const w = die.weights;
    const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return Math.ceil(Math.random() * 6);
    let r = Math.random() * total;
    for (let i = 0; i < 6; i++) {
      r -= w[i];
      if (r < 0) return i + 1;
    }
    return 6;
  });
}

/**
 * Rolls all `dice` through the full pipeline:
 * reset → applyModifiers → resolveLuckyDice → clamp → rollDice
 */
export function performRoll(dice: Die[], modifiers: Modifier[]): number[] {
  resetWeights(dice);
  applyModifiers(dice, modifiers);
  resolveLuckyDice(dice);
  clampWeights(dice);
  return rollDice(dice);
}

/**
 * Builds the static modifier list from the initial dice config.
 * All current die types encode their behaviour in `baseWeights` directly
 * (biased dice) or in `resolveLuckyDice` (lucky/unlucky), so this function
 * currently returns an empty array. It exists as an extension point for
 * future modifier types (e.g. a curse that blocks a face at runtime).
 */
export function buildModifiersFromConfig(_config: DieType[]): Modifier[] {
  return [];
}
