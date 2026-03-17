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
} from './gameState';

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

describe('selectDie edge cases', () => {
  it('does nothing for non-existent meshIndex', () => {
    const state = createInitialTurnState();
    selectDie(state, 999);
    expect(state.diceState.every(d => !d.selected)).toBe(true);
  });

  it('selecting a setAside die still marks it selected', () => {
    const state = createInitialTurnState();
    state.diceState[0].setAside = true;
    selectDie(state, 0);
    expect(state.diceState[0].selected).toBe(true);
  });
});

describe('deselectDie edge cases', () => {
  it('does nothing for non-existent meshIndex', () => {
    const state = createInitialTurnState();
    state.diceState[0].selected = true;
    deselectDie(state, 999);
    expect(state.diceState[0].selected).toBe(true);
  });
});

describe('applyRollResult edge cases', () => {
  it('fewer values than active dice fills remainder with 0', () => {
    const state = createInitialTurnState();
    applyRollResult(state, [3, 5]);
    expect(state.diceState[0].value).toBe(3);
    expect(state.diceState[1].value).toBe(5);
    expect(state.diceState[2].value).toBe(0);
  });

  it('calling twice overwrites previous values', () => {
    const state = createInitialTurnState();
    applyRollResult(state, [1, 2, 3, 4, 5, 6]);
    applyRollResult(state, [6, 5, 4, 3, 2, 1]);
    expect(state.diceState[0].value).toBe(6);
    expect(state.diceState[5].value).toBe(1);
  });
});

describe('endTurn edge cases', () => {
  it('with turnScore=0 returns currentTotal unchanged', () => {
    const state = createInitialTurnState();
    state.turnScore = 0;
    expect(endTurn(state, 500)).toBe(500);
  });
});

describe('multi-step turn', () => {
  it('select → commit → roll → select → commit → endTurn accumulates correctly', () => {
    const state = createInitialTurnState();

    // First roll: [1, 5, 2, 3, 4, 6]
    applyRollResult(state, [1, 5, 2, 3, 4, 6]);
    selectDie(state, 0); // face 1
    selectDie(state, 1); // face 5
    commitSelection(state, 150); // 100 + 50
    expect(state.turnScore).toBe(150);
    expect(state.diceState[0].setAside).toBe(true);
    expect(state.diceState[1].setAside).toBe(true);

    // Second roll: only 4 active dice → [1, 1, 1, 6]
    applyRollResult(state, [1, 1, 1, 6]);
    // Dice 0,1 are setAside; dice 2,3,4 got [1,1,1], dice 5 got 6
    expect(state.diceState[0].value).toBe(1); // still old value, setAside
    expect(state.diceState[2].value).toBe(1);
    expect(state.diceState[3].value).toBe(1);
    expect(state.diceState[4].value).toBe(1);
    expect(state.diceState[5].value).toBe(6);

    selectDie(state, 2);
    selectDie(state, 3);
    selectDie(state, 4);
    commitSelection(state, 1000); // triple 1s
    expect(state.turnScore).toBe(1150);

    const newTotal = endTurn(state, 800);
    expect(newTotal).toBe(1950);
    expect(state.turnScore).toBe(0);
    state.diceState.forEach(d => {
      expect(d.setAside).toBe(false);
      expect(d.selected).toBe(false);
    });
  });
});
