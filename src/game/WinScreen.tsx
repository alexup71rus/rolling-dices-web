// src/game/WinScreen.tsx
import { component$, useContext } from '@builder.io/qwik';
import { GameContext } from './gameState';

export const WinScreen = component$(() => {
  const store = useContext(GameContext);

  return (
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
      <div style="background:#0f172a;border-radius:12px;padding:32px;text-align:center;color:#fff;min-width:300px;">
        <div style="font-size:48px;margin-bottom:16px;">🏆</div>
        <h2 style="margin:0 0 8px;font-size:24px;">Победа!</h2>
        <div style="color:#4ade80;font-size:36px;font-weight:bold;margin-bottom:4px;">
          {store.totalScore.toLocaleString()}
        </div>
        <div style="color:#aaa;font-size:14px;margin-bottom:24px;">
          из {store.target.toLocaleString()} очков
        </div>
        <div style="height:4px;background:#1e293b;border-radius:2px;margin-bottom:24px;">
          <div style="width:100%;height:100%;background:#4ade80;border-radius:2px;" />
        </div>
        <button
          style="width:100%;padding:12px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;"
          onClick$={() => {
            store.screen = 'setup';
            store.totalScore = 0;
            store.turnScore = 0;
            store.diceConfig = ['normal', 'normal', 'normal', 'normal', 'normal', 'normal'];
            store.diceState = Array.from({ length: 6 }, (_, i) => ({
              value: 0, selected: false, setAside: false,
              scoreContribution: 0, dieType: 'normal' as const, meshIndex: i,
            }));
          }}
        >
          🔄 Играть снова
        </button>
      </div>
    </div>
  );
});
