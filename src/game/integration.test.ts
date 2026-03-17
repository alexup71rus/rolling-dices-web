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

    // Force a known roll outcome by overriding weights (set baseWeights too since performRoll calls resetWeights)
    dice.forEach(d => { d.baseWeights = [100, 0, 0, 0, 0, 0]; d.weights = [100, 0, 0, 0, 0, 0]; }); // always rolls 1
    const values = performRoll(dice, modifiers);
    // All 6 should be 1
    values.forEach(v => expect(v).toBe(1));

    applyRollResult(state, values);
    const combos = detectCombinations(values);
    const pts = scoreCombinations(combos);
    // Six 1s = triple(1000) + triple(1000) = 2000
    expect(pts).toBe(2000);
    expect(isFarkle(values)).toBe(false);

    state.diceState.forEach(d => { d.selected = true; });
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
