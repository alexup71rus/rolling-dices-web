// src/freeroll/FreeRollSetupScreen.tsx
import { component$, useContext, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from '../game/gameState';

export const FreeRollSetupScreen = component$(() => {
  const store = useContext(GameContext);

  useVisibleTask$(({ cleanup }) => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'ArrowLeft' || key === 'a') {
        e.preventDefault();
        if (store.freerollDiceCount > 1) store.freerollDiceCount--;
        return;
      }
      if (key === 'ArrowRight' || key === 'd') {
        e.preventDefault();
        if (store.freerollDiceCount < 6) store.freerollDiceCount++;
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        store.screen = 'freeroll';
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        store.screen = 'mode-select';
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  const diceIcons = () => Array.from({ length: store.freerollDiceCount }, () => '🎲');

  return (
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="background:rgba(43, 23, 7, 0.6);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.15);box-shadow:0 12px 40px rgba(0,0,0,0.5);border-radius:16px;padding:32px;width:420px;color:#fef3c7;">
        <h2 style="margin:0 0 24px;font-size:24px;text-align:center;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.5);letter-spacing:1px;display:flex;align-items:center;justify-content:center;gap:10px;">
          <span style="font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🎲</span> Бросок кубиков
        </h2>

        {/* Dice count selector */}
        <div style="margin-bottom:24px;">
          <div style="font-size:12px;color:#d4d4d8;letter-spacing:1.5px;margin-bottom:14px;text-transform:uppercase;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);text-align:center;">Количество кубиков</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:20px;">
            <span
              style={`font-size:32px;cursor:${store.freerollDiceCount > 1 ? 'pointer' : 'default'};color:${store.freerollDiceCount > 1 ? '#fbbf24' : 'rgba(255,255,255,0.2)'};user-select:none;transition:transform 0.1s;padding:0 12px;`}
              onClick$={() => { if (store.freerollDiceCount > 1) store.freerollDiceCount--; }}
              onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
              onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
              onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
            >−</span>
            <span style="font-size:48px;font-weight:800;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.5);min-width:60px;text-align:center;">
              {store.freerollDiceCount}
            </span>
            <span
              style={`font-size:32px;cursor:${store.freerollDiceCount < 6 ? 'pointer' : 'default'};color:${store.freerollDiceCount < 6 ? '#fbbf24' : 'rgba(255,255,255,0.2)'};user-select:none;transition:transform 0.1s;padding:0 12px;`}
              onClick$={() => { if (store.freerollDiceCount < 6) store.freerollDiceCount++; }}
              onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
              onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
              onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
            >+</span>
          </div>
        </div>

        {/* Preview icons */}
        <div style="display:flex;gap:10px;justify-content:center;padding:12px;background:rgba(0,0,0,0.3);border-radius:10px;margin-bottom:24px;font-size:30px;box-shadow:inset 0 2px 6px rgba(0,0,0,0.5);">
          {diceIcons().map((icon, i) => <span key={i} style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">{icon}</span>)}
        </div>

        {/* Start button */}
        <button
          class="freeroll-start-btn"
          style="width:100%;padding:16px;font-size:16px;background:linear-gradient(to bottom, #d97706, #b45309);color:#fff;border:1px solid #f59e0b;border-radius:10px;cursor:pointer;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.4);box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all 0.2s ease;"
          onMouseOver$={(e) => (e.target as HTMLElement).style.filter='brightness(1.1)'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.filter='brightness(1)'}
          onClick$={() => { store.screen = 'freeroll'; }}
        >
          🎲 Начать <kbd style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:1px 6px;font-size:11px;margin-left:6px;font-family:system-ui;font-weight:600;">Enter</kbd>
        </button>

        <button
          style="width:100%;padding:12px;font-size:14px;background:transparent;color:#a1a1aa;border:1px solid rgba(255,255,255,0.15);border-radius:10px;cursor:pointer;margin-top:10px;transition:all 0.2s ease;"
          onMouseOver$={(e) => (e.target as HTMLElement).style.color='#fef3c7'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.color='#a1a1aa'}
          onClick$={() => { store.screen = 'mode-select'; }}
        >
          ← Назад <kbd style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:1px 6px;font-size:11px;margin-left:6px;font-family:system-ui;font-weight:600;">Esc</kbd>
        </button>
      </div>
    </div>
  );
});
