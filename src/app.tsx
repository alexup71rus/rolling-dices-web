// src/app.tsx
import { component$, useStore, useContextProvider } from '@builder.io/qwik';
import { GameContext, type GameStore } from './game/gameState';
import type { DieType } from './game/diceModifiers';
import { SetupScreen } from './game/SetupScreen';
import { GameScreen } from './game/GameScreen';
import { WinScreen } from './game/WinScreen';

export const App = component$(() => {
  const store = useStore<GameStore>({
    screen: 'setup',
    target: 3000,
    diceConfig: ['normal', 'normal', 'normal', 'normal', 'normal', 'normal'] as DieType[],
    totalScore: 0,
    turnScore: 0,
    diceState: Array.from({ length: 6 }, (_, i) => ({
      value: 0,
      selected: false,
      setAside: false,
      scoreContribution: 0,
      dieType: 'normal' as DieType,
      meshIndex: i,
    })),
  });

  useContextProvider(GameContext, store);

  return (
    <div style="width:100vw;height:100vh;overflow:hidden;background:#0d1117;">
      {store.screen === 'setup' && <SetupScreen />}
      {store.screen === 'game'  && <GameScreen />}
      {store.screen === 'win'   && <WinScreen />}
    </div>
  );
});
