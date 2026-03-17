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
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        /* Wooden background using gradient and SVG noise */
        backgroundColor: '#3e2723',
        backgroundImage: `
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.12'/%3E%3C/svg%3E"),
          radial-gradient(circle at 50% 50%, #704214 0%, #2b1707 100%)
        `,
        backgroundBlendMode: 'overlay, normal',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {store.screen === 'setup' && <SetupScreen />}
      {store.screen === 'game'  && <GameScreen />}
      {store.screen === 'win'   && <WinScreen />}
    </div>
  );
});
