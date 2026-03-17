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
