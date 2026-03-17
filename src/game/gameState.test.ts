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
    state.diceState[0].setAside = true;
    const rollValues = [3, 5, 2, 4, 1, 6];
    applyRollResult(state, rollValues);
    expect(state.diceState[0].value).toBe(0); // set-aside unchanged
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
