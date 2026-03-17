// src/game/WinScreen.tsx
import { component$, useContext } from '@builder.io/qwik';
import { GameContext } from './gameState';

export const WinScreen = component$(() => {
  const store = useContext(GameContext);

  return (
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui, -apple-system, sans-serif;">
      <div style="background:rgba(43, 23, 7, 0.6);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.15);box-shadow:0 12px 40px rgba(0,0,0,0.5);border-radius:16px;padding:40px;text-align:center;color:#fef3c7;min-width:320px;">
        <div style="font-size:56px;margin-bottom:16px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));">🏆</div>
        <h2 style="margin:0 0 8px;font-size:28px;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.5);">Победа!</h2>
        <div style="color:#4ade80;font-size:42px;font-weight:800;margin-bottom:4px;text-shadow:0 2px 4px rgba(0,0,0,0.5);">
          {store.totalScore.toLocaleString()}
        </div>
        <div style="color:#d4d4d8;font-size:14px;margin-bottom:28px;font-weight:500;">
          из {store.target.toLocaleString()} очков
        </div>
        <div style="height:6px;background:rgba(0,0,0,0.4);border-radius:3px;margin-bottom:28px;border:1px solid rgba(255,255,255,0.05);">
          <div style="width:100%;height:100%;background:linear-gradient(90deg, #22c55e, #10b981);border-radius:3px;box-shadow:0 0 8px rgba(34,197,94,0.5);" />
        </div>
        <button
          style="width:100%;padding:16px;font-size:16px;background:linear-gradient(to bottom, #d97706, #b45309);color:#fff;border:1px solid #f59e0b;border-radius:10px;cursor:pointer;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.4);box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all 0.2s ease;"
          onMouseOver$={(e) => (e.target as HTMLElement).style.filter='brightness(1.1)'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.filter='brightness(1)'}
          onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.96)'}
          onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
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
