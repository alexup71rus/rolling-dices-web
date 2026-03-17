# Game Logic Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all pure-TypeScript game logic — scoring engine, dice modifier system, and game state machine — with full unit-test coverage and zero Three.js dependencies.

**Architecture:** Three focused modules: `scoring.ts` detects combinations and computes points, `diceModifiers.ts` owns the weighted-probability roll system, and `gameState.ts` holds the Qwik store and turn-flow transitions. All modules are side-effect free and imported by the UI layer in later plans.

**Tech Stack:** TypeScript, Vitest, Qwik (`useStore`, `createContextId`)

**Spec:** `docs/superpowers/specs/2026-03-17-dice-game-design.md`

---

## Chunk 1: Scoring Engine

### Task 1: `scoring.ts` — combination detection

**Files:**
- Create: `src/game/scoring.ts`
- Create: `src/game/scoring.test.ts`

- [ ] **Step 1: Create test file with failing tests for `detectCombinations`**

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/T7/Projects/dice && pnpm test -- src/game/scoring.test.ts
```
Expected: FAIL — `Cannot find module './scoring'`

- [ ] **Step 3: Implement `scoring.ts`**

```ts
// src/game/scoring.ts

export type CombinationType = 'single' | 'triple' | 'straight';

export interface Combination {
  type: CombinationType;
  face?: number;       // present for 'single' and 'triple'
  diceIndices: number[];
  points: number;
}

const TRIPLE_POINTS: Record<number, number> = {
  1: 1000, 2: 200, 3: 300, 4: 400, 5: 500, 6: 600,
};

/**
 * Greedily detects all scoring combinations in a roll.
 * Priority: straight > triples > singles.
 * Each die index is used at most once.
 */
export function detectCombinations(faces: number[]): Combination[] {
  const used = new Set<number>();
  const combos: Combination[] = [];

  // 1. Straight 1-2-3-4-5 (needs exactly these 5 values present)
  const straightFaces = [1, 2, 3, 4, 5];
  const straightIndices: number[] = [];
  for (const f of straightFaces) {
    const idx = faces.findIndex((v, i) => v === f && !used.has(i));
    if (idx !== -1) straightIndices.push(idx);
  }
  if (straightIndices.length === 5) {
    straightIndices.forEach(i => used.add(i));
    combos.push({ type: 'straight', diceIndices: straightIndices, points: 1500 });
  }

  // 2. Triples (three-of-a-kind)
  for (let face = 1; face <= 6; face++) {
    const indices = faces
      .map((v, i) => (v === face && !used.has(i) ? i : -1))
      .filter(i => i !== -1);
    if (indices.length >= 3) {
      const triple = indices.slice(0, 3);
      triple.forEach(i => used.add(i));
      combos.push({ type: 'triple', face, diceIndices: triple, points: TRIPLE_POINTS[face] });
    }
  }

  // 3. Singles: remaining 1s and 5s
  faces.forEach((v, i) => {
    if (used.has(i)) return;
    if (v === 1) { used.add(i); combos.push({ type: 'single', face: 1, diceIndices: [i], points: 100 }); }
    if (v === 5) { used.add(i); combos.push({ type: 'single', face: 5, diceIndices: [i], points: 50 }); }
  });

  return combos;
}

export function scoreCombinations(combos: Combination[]): number {
  return combos.reduce((sum, c) => sum + c.points, 0);
}

/**
 * Returns true if every die index in `activeIndices` is covered by
 * at least one combination (used for Hot Dice detection).
 */
export function isHotDice(faces: number[], activeIndices: number[]): boolean {
  const combos = detectCombinations(faces);
  const covered = new Set(combos.flatMap(c => c.diceIndices));
  return activeIndices.every(i => covered.has(i));
}

/**
 * Returns true if no scoring combination exists (Farkle).
 */
export function isFarkle(faces: number[]): boolean {
  return detectCombinations(faces).length === 0;
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pnpm test -- src/game/scoring.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/scoring.ts src/game/scoring.test.ts
git commit -m "feat(game): scoring engine with combination detection and greedy scoring"
```

---

## Chunk 2: Dice Modifier System

### Task 2: `diceModifiers.ts` — weighted roll with modifiers

**Files:**
- Create: `src/game/diceModifiers.ts`
- Create: `src/game/diceModifiers.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
    const calls: number[] = [];
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
    result.forEach(v => expect(v).toBeGreaterThanOrEqual(1) && expect(v).toBeLessThanOrEqual(6));
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/game/diceModifiers.test.ts
```
Expected: FAIL — `Cannot find module './diceModifiers'`

- [ ] **Step 3: Implement `diceModifiers.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pnpm test -- src/game/diceModifiers.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/diceModifiers.ts src/game/diceModifiers.test.ts
git commit -m "feat(game): dice modifier system with weighted roll and lucky/unlucky dice"
```

---

## Chunk 3: Game State Machine

### Task 3: `gameState.ts` — Qwik store and turn-flow transitions

**Files:**
- Create: `src/game/gameState.ts`
- Create: `src/game/gameState.test.ts`

- [ ] **Step 1: Write failing tests for pure state-transition functions**

```ts
// src/game/gameState.test.ts
import { describe, expect, it } from 'vitest';
import {
  createInitialTurnState,
  applyRollResult,
  selectDie,
  deselectDie,
  commitSelection,
  endTurn,
  nextTurn,
  resetForHotDice,
  type TurnState,
  type DiceRollState,
} from './gameState';

function makeDice(values: number[], setAside = false): DiceRollState[] {
  return values.map((v, i) => ({
    value: v,
    selected: false,
    setAside,
    scoreContribution: 0,
    dieType: 'normal' as const,
    meshIndex: i,
  }));
}

describe('createInitialTurnState', () => {
  it('creates 6 dice in unrolled state', () => {
    const state = createInitialTurnState();
    expect(state.diceState).toHaveLength(6);
    state.diceState.forEach(d => {
      expect(d.value).toBe(0);
      expect(d.selected).toBe(false);
      expect(d.setAside).toBe(false);
    });
    expect(state.turnScore).toBe(0);
  });
});

describe('applyRollResult', () => {
  it('sets values on non-set-aside dice only', () => {
    const state = createInitialTurnState();
    // Mark dice 0 as set-aside
    state.diceState[0].setAside = true;
    const rollValues = [3, 5, 2, 4]; // 4 active dice
    applyRollResult(state, rollValues);
    expect(state.diceState[0].value).toBe(0); // set-aside unchanged
    // Active dice (indices 1–5) get new values
    const active = state.diceState.filter(d => !d.setAside);
    active.forEach((d, i) => expect(d.value).toBe(rollValues[i]));
  });
});

describe('selectDie', () => {
  it('marks die as selected', () => {
    const state = createInitialTurnState();
    state.diceState[2].value = 1;
    selectDie(state, 2);
    expect(state.diceState[2].selected).toBe(true);
  });
});

describe('deselectDie', () => {
  it('clears selected flag', () => {
    const state = createInitialTurnState();
    state.diceState[2].selected = true;
    deselectDie(state, 2);
    expect(state.diceState[2].selected).toBe(false);
  });
});

describe('commitSelection', () => {
  it('moves selected dice to setAside=true and adds score to turnScore', () => {
    const state = createInitialTurnState();
    // Roll [1, 5, 2, 3, 4, 6] and select die 0 (value=1, 100pts) and die 1 (value=5, 50pts)
    state.diceState.forEach((d, i) => { d.value = [1, 5, 2, 3, 4, 6][i]; });
    state.diceState[0].selected = true;
    state.diceState[1].selected = true;
    commitSelection(state, 150);
    expect(state.diceState[0].setAside).toBe(true);
    expect(state.diceState[1].setAside).toBe(true);
    expect(state.diceState[0].selected).toBe(false);
    expect(state.turnScore).toBe(150);
  });
});

describe('endTurn', () => {
  it('adds turnScore to totalScore and resets turn state', () => {
    const state = createInitialTurnState();
    state.turnScore = 450;
    const totalScore = endTurn(state, 300);
    expect(totalScore).toBe(750);
    expect(state.turnScore).toBe(0);
    state.diceState.forEach(d => {
      expect(d.setAside).toBe(false);
      expect(d.selected).toBe(false);
      expect(d.value).toBe(0);
    });
  });
});

describe('nextTurn (after Farkle)', () => {
  it('resets turn score to 0 and clears all dice', () => {
    const state = createInitialTurnState();
    state.turnScore = 300;
    state.diceState[0].setAside = true;
    nextTurn(state);
    expect(state.turnScore).toBe(0);
    state.diceState.forEach(d => {
      expect(d.setAside).toBe(false);
      expect(d.value).toBe(0);
    });
  });
});

describe('resetForHotDice', () => {
  it('clears all dice state but preserves turnScore', () => {
    const state = createInitialTurnState();
    state.turnScore = 500;
    state.diceState[0].setAside = true;
    state.diceState[1].selected = true;
    state.diceState[2].value = 3;
    resetForHotDice(state);
    expect(state.turnScore).toBe(500); // preserved
    state.diceState.forEach(d => {
      expect(d.setAside).toBe(false);
      expect(d.selected).toBe(false);
      expect(d.value).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- src/game/gameState.test.ts
```
Expected: FAIL — `Cannot find module './gameState'`

- [ ] **Step 3: Implement `gameState.ts`**

```ts
// src/game/gameState.ts
import { createContextId } from '@builder.io/qwik';
import type { DieType } from './diceModifiers';

export interface DiceRollState {
  value: number;
  selected: boolean;
  setAside: boolean;
  scoreContribution: number;
  dieType: DieType;
  meshIndex: number;
}

export interface TurnState {
  diceState: DiceRollState[];
  turnScore: number;
}

export interface GameStore {
  screen: 'setup' | 'game' | 'win';
  target: 2000 | 3000 | 4000;
  diceConfig: DieType[];
  totalScore: number;
  turnScore: number;
  diceState: DiceRollState[];
}

export const GameContext = createContextId<GameStore>('game-store');

export function createInitialTurnState(): TurnState {
  return {
    turnScore: 0,
    diceState: Array.from({ length: 6 }, (_, i) => ({
      value: 0,
      selected: false,
      setAside: false,
      scoreContribution: 0,
      dieType: 'normal' as DieType,
      meshIndex: i,
    })),
  };
}

/** Applies roll values to active (non-setAside) dice in order. */
export function applyRollResult(state: TurnState, values: number[]): void {
  let vi = 0;
  for (const d of state.diceState) {
    if (!d.setAside) {
      d.value = values[vi++] ?? 0;
      d.selected = false;
    }
  }
}

export function selectDie(state: TurnState, meshIndex: number): void {
  const d = state.diceState.find(d => d.meshIndex === meshIndex);
  if (d) d.selected = true;
}

export function deselectDie(state: TurnState, meshIndex: number): void {
  const d = state.diceState.find(d => d.meshIndex === meshIndex);
  if (d) d.selected = false;
}

/**
 * Moves selected dice to setAside and adds pointsToAdd to turnScore.
 * pointsToAdd is computed externally by the scoring engine.
 */
export function commitSelection(state: TurnState, pointsToAdd: number): void {
  for (const d of state.diceState) {
    if (d.selected) {
      d.setAside = true;
      d.selected = false;
    }
  }
  state.turnScore += pointsToAdd;
}

/** Resets Hot Dice: all dice return, turnScore preserved. */
export function resetForHotDice(state: TurnState): void {
  for (const d of state.diceState) {
    d.setAside = false;
    d.selected = false;
    d.value = 0;
  }
}

/** Banks turn score. Returns new total. Resets turn state. */
export function endTurn(state: TurnState, currentTotal: number): number {
  const newTotal = currentTotal + state.turnScore;
  state.turnScore = 0;
  for (const d of state.diceState) {
    d.setAside = false;
    d.selected = false;
    d.value = 0;
    d.scoreContribution = 0;
  }
  return newTotal;
}

/** Farkle: resets turn score and all dice. */
export function nextTurn(state: TurnState): void {
  state.turnScore = 0;
  for (const d of state.diceState) {
    d.setAside = false;
    d.selected = false;
    d.value = 0;
    d.scoreContribution = 0;
  }
}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pnpm test -- src/game/gameState.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Run full test suite to ensure nothing is broken**

```bash
pnpm test
```
Expected: all tests PASS (existing `diceLogic` tests included)

- [ ] **Step 6: Commit**

```bash
git add src/game/gameState.ts src/game/gameState.test.ts
git commit -m "feat(game): game state machine with turn-flow transitions"
```

---

## Chunk 4: Integration Smoke Test

### Task 4: Verify all three modules work together

**Files:**
- Create: `src/game/integration.test.ts`

- [ ] **Step 1: Write integration test covering a full turn**

```ts
// src/game/integration.test.ts
import { describe, expect, it } from 'vitest';
import { createDie, performRoll, buildModifiersFromConfig, type DieType } from './diceModifiers';
import { detectCombinations, scoreCombinations, isFarkle, isHotDice } from './scoring';
import {
  createInitialTurnState,
  applyRollResult,
  commitSelection,
  endTurn,
  nextTurn,
} from './gameState';

describe('full turn simulation', () => {
  it('normal turn: roll → select scoring dice → bank → totalScore increases', () => {
    const config: DieType[] = ['normal', 'normal', 'normal', 'normal', 'normal', 'normal'];
    const dice = config.map(t => createDie(t));
    const modifiers = buildModifiersFromConfig(config);
    const state = createInitialTurnState();

    // Force a known roll outcome by overriding weights
    dice.forEach(d => { d.weights = [100, 0, 0, 0, 0, 0]; }); // always rolls 1
    const values = performRoll(dice, modifiers);
    // All 6 should be 1
    values.forEach(v => expect(v).toBe(1));

    applyRollResult(state, values);
    const combos = detectCombinations(values);
    const pts = scoreCombinations(combos);
    // Three 1s = 1000, three 1s = 1000 → 2000 total? No: six 1s = triple(1000) + triple(1000) via greedy
    // Actually: first triple uses indices 0-2, second triple uses 3-5
    expect(pts).toBe(2000);
    expect(isFarkle(values)).toBe(false);

    state.diceState.forEach((d, i) => { d.selected = true; });
    commitSelection(state, pts);
    expect(state.turnScore).toBe(2000);

    const newTotal = endTurn(state, 0);
    expect(newTotal).toBe(2000);
    expect(state.turnScore).toBe(0);
  });

  it('farkle: turn score goes to 0', () => {
    const state = createInitialTurnState();
    const farkleRoll = [2, 3, 4, 6, 2, 3];
    applyRollResult(state, farkleRoll);
    expect(isFarkle(farkleRoll)).toBe(true);
    nextTurn(state);
    expect(state.turnScore).toBe(0);
  });

  it('hot dice: all 6 dice score', () => {
    const hotRoll = [1, 1, 1, 5, 5, 5]; // triple 1s + triple 5s
    const activeIndices = [0, 1, 2, 3, 4, 5];
    expect(isHotDice(hotRoll, activeIndices)).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
pnpm test -- src/game/integration.test.ts
```
Expected: all tests PASS

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/game/integration.test.ts
git commit -m "test(game): integration smoke test covering full turn simulation"
```
