// src/freeroll/FreeRollScreen.tsx
import { $, component$, noSerialize, useContext, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from '../game/gameState';
import type { FreeRollController } from './FreeRollController';

export const FreeRollScreen = component$(() => {
  const store = useContext(GameContext);
  const canvasRef = useSignal<HTMLCanvasElement>();
  const controllerRef = useSignal<any>(null);
  const rolling = useSignal(false);
  const values = useSignal<number[]>([]);
  const sceneError = useSignal('');

  useVisibleTask$(async ({ cleanup }) => {
    if (!canvasRef.value) return;
    let ctrl: FreeRollController | null = null;
    try {
      const { createFreeRollController } = await import('./FreeRollController');
      ctrl = await createFreeRollController(canvasRef.value, store.freerollDiceCount);
      controllerRef.value = noSerialize(ctrl);

      // Auto-roll on load
      rolling.value = true;
      const result = await ctrl.roll();
      values.value = result;
      rolling.value = false;
    } catch (err) {
      sceneError.value = err instanceof Error ? err.message : 'Failed to initialize 3D scene';
    }

    // Keyboard handler
    const onKeyDown = async (e: KeyboardEvent) => {
      if (!ctrl) return;
      if ((e.key === 'Enter' || e.key === ' ') && !rolling.value) {
        e.preventDefault();
        rolling.value = true;
        const result = await ctrl.roll();
        values.value = result;
        rolling.value = false;
        return;
      }
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        store.screen = 'freeroll-setup';
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanup(() => {
      window.removeEventListener('keydown', onKeyDown);
      ctrl?.dispose();
    });
  });

  const handleRoll = $(async () => {
    const ctrl = controllerRef.value as FreeRollController | null;
    if (!ctrl || rolling.value) return;
    rolling.value = true;
    const result = await ctrl.roll();
    values.value = result;
    rolling.value = false;
  });

  const sum = () => values.value.reduce((a, b) => a + b, 0);

  const FACE_EMOJI: Record<number, string> = {
    1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
  };

  return (
    <div style="display:flex;height:100vh;width:100vw;">
      {/* 3D scene */}
      <div style="flex:1;position:relative;">
        <canvas
          ref={canvasRef}
          style="width:100%;height:100%;display:block;background:transparent;"
        />
        {sceneError.value && (
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#ef4444;font-size:16px;text-align:center;padding:20px;">
            {sceneError.value}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style="width:280px;display:flex;flex-direction:column;padding:20px;gap:16px;background:rgba(43, 23, 7, 0.6);backdrop-filter:blur(16px);border-left:1px solid rgba(255,255,255,0.1);color:#fef3c7;">
        <h2 style="margin:0;font-size:20px;text-align:center;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;gap:8px;">
          <span style="font-size:24px;">🎲</span> Бросок кубиков
        </h2>

        {/* Results */}
        {values.value.length > 0 && !rolling.value && (
          <div style="background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;">
            <div style="font-size:11px;color:#d4d4d8;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;margin-bottom:10px;text-shadow:0 1px 2px rgba(0,0,0,0.5);">Результат</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;">
              {values.value.map((v, i) => (
                <div key={i} style="font-size:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                  {FACE_EMOJI[v] ?? v}
                </div>
              ))}
            </div>
            <div style="text-align:center;font-size:14px;color:#d4d4d8;">
              Сумма: <span style="font-size:24px;font-weight:800;color:#fbbf24;text-shadow:0 1px 3px rgba(0,0,0,0.5);">{sum()}</span>
            </div>
          </div>
        )}

        {rolling.value && (
          <div style="text-align:center;color:#d4d4d8;font-size:14px;padding:20px;">
            Кубики летят...
          </div>
        )}

        <div style="flex:1;" />

        {/* Roll button */}
        <button
          style={`width:100%;padding:16px;font-size:16px;background:linear-gradient(to bottom, #d97706, #b45309);color:#fff;border:1px solid #f59e0b;border-radius:10px;cursor:${rolling.value ? 'default' : 'pointer'};font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.4);box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all 0.2s ease;opacity:${rolling.value ? '0.6' : '1'};`}
          onMouseOver$={(e) => (e.target as HTMLElement).style.filter='brightness(1.1)'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.filter='brightness(1)'}
          onClick$={handleRoll}
          disabled={rolling.value}
        >
          🎲 Бросить <kbd style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:1px 6px;font-size:11px;margin-left:6px;font-family:system-ui;font-weight:600;">Space</kbd>
        </button>

        {/* Back button */}
        <button
          style="width:100%;padding:12px;font-size:14px;background:transparent;color:#a1a1aa;border:1px solid rgba(255,255,255,0.15);border-radius:10px;cursor:pointer;transition:all 0.2s ease;"
          onMouseOver$={(e) => (e.target as HTMLElement).style.color='#fef3c7'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.color='#a1a1aa'}
          onClick$={() => { store.screen = 'freeroll-setup'; }}
        >
          ← Назад <kbd style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:1px 6px;font-size:11px;margin-left:6px;font-family:system-ui;font-weight:600;">Esc</kbd>
        </button>
      </div>
    </div>
  );
});
