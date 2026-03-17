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
