// src/game/GameScreen.tsx
import { component$, useContext, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from './gameState';
import { detectCombinations, scoreCombinations } from './scoring';
import type { TurnPhase } from './GameSceneController';

export const GameScreen = component$(() => {
  const store = useContext(GameContext);
  const canvasRef = useSignal<HTMLCanvasElement>();
  const phase = useSignal<TurnPhase>('idle');
  const farkleButtonVisible = useSignal(false);
  const controllerRef = useSignal<any>(null);
  const sceneError = useSignal<string>('');

  useVisibleTask$(async ({ cleanup }) => {
    if (!canvasRef.value) return;
    try {
      const { createGameSceneController } = await import('./GameSceneController');
      controllerRef.value = await createGameSceneController(
        canvasRef.value,
        store,
        (p: TurnPhase) => {
          phase.value = p;
          if (p === 'farkle') {
            farkleButtonVisible.value = false;
            setTimeout(() => { farkleButtonVisible.value = true; }, 2000);
          }
        },
      );
    } catch (err) {
      sceneError.value = err instanceof Error ? err.message : 'Failed to initialize 3D scene';
      phase.value = 'idle';
      controllerRef.value = null;
    }

    cleanup(() => {
      controllerRef.value?.dispose?.();
      controllerRef.value = null;
    });
  });

  // Derive active dice (not set aside)
  const activeDiceState = () => store.diceState.filter(d => !d.setAside);
  const setAsideDice = () => store.diceState.filter(d => d.setAside);
  const activeMeshIndices = () => activeDiceState().map(d => d.meshIndex);
  const activeValues = () => activeDiceState().map(d => d.value);

  // Selected combos and their score
  const selectedCombos = () => {
    const vals = activeValues();
    if (vals.every(v => v === 0)) return [];
    const combos = detectCombinations(vals);
    const selectedLocal = activeDiceState()
      .map((d, i) => d.selected ? i : -1)
      .filter(i => i !== -1);
    return combos.filter(c => c.diceIndices.every(i => selectedLocal.includes(i)));
  };
  const selectedPoints = () => scoreCombinations(selectedCombos());
  const hasSelection = () => selectedCombos().length > 0;

  return (
    <div style="display:flex;height:100vh;font-family:sans-serif;">

      {/* 3D canvas area */}
      <div style="flex:1;position:relative;background:#050810;">
        <canvas
          ref={canvasRef}
          style="width:100%;height:100%;"
        />

        {sceneError.value && (
          <div style="position:absolute;left:16px;bottom:16px;background:rgba(120,20,20,0.9);color:#fecaca;border:1px solid #7f1d1d;border-radius:8px;padding:8px 10px;font-size:11px;max-width:380px;">
            3D scene error: {sceneError.value}
          </div>
        )}

        {/* Set-aside strip */}
        {setAsideDice().length > 0 && (
          <div style="position:absolute;top:0;left:0;right:0;padding:8px 12px;background:rgba(0,0,0,0.6);display:flex;gap:12px;align-items:center;">
            <span style="font-size:10px;color:#555;letter-spacing:1px;">ОТЛОЖЕНО</span>
            {setAsideDice().map(d => (
              <div key={d.meshIndex} style="text-align:center;">
                <div style="font-size:20px;opacity:0.5;">{['⚀','⚁','⚂','⚃','⚄','⚅'][d.value - 1] ?? '⚀'}</div>
                <div style="font-size:9px;color:#4ade80;">{d.scoreContribution}</div>
              </div>
            ))}
          </div>
        )}

        {/* Hot Dice banner */}
        {phase.value === 'hot-dice' && (
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#1a2e1a;border:2px solid #166534;border-radius:10px;padding:16px 24px;text-align:center;">
            <div style="font-size:20px;color:#4ade80;font-weight:bold;">🔥 Горячие кости!</div>
            <div style="font-size:12px;color:#86efac;margin-top:4px;">Все кубики возвращаются — очки сохраняются</div>
          </div>
        )}

        {/* Farkle banner */}
        {phase.value === 'farkle' && (
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#2a0a0a;border:2px solid #7f1d1d;border-radius:10px;padding:16px 24px;text-align:center;">
            <div style="font-size:20px;color:#f87171;font-weight:bold;">💀 Фаркл!</div>
            <div style="font-size:12px;color:#fca5a5;margin-top:4px;">Очки за ход сгорают</div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style="width:190px;background:#0f172a;padding:14px;display:flex;flex-direction:column;gap:10px;color:#fff;">

        {/* Scores */}
        <div style="background:#0d1117;border-radius:8px;padding:12px;">
          <div style="font-size:10px;color:#aaa;letter-spacing:1px;">ОЧКИ ЗА ХОД</div>
          <div style="font-size:26px;font-weight:bold;color:#fbbf24;line-height:1.1;">{store.turnScore}</div>
          <div style="height:1px;background:#1e293b;margin:8px 0;" />
          <div style="font-size:10px;color:#aaa;letter-spacing:1px;">ВСЕГО</div>
          <div style="font-size:20px;font-weight:bold;color:#4ade80;line-height:1.1;">{store.totalScore.toLocaleString()}</div>
          <div style="height:1px;background:#1e293b;margin:8px 0;" />
          <div style="display:flex;justify-content:space-between;">
            <span style="font-size:10px;color:#aaa;">ЦЕЛЬ</span>
            <span style="font-size:12px;">{store.target.toLocaleString()}</span>
          </div>
          <div style="height:4px;background:#1e293b;border-radius:2px;margin-top:4px;">
            <div style={`height:100%;background:#4ade80;border-radius:2px;width:${Math.min(100, (store.totalScore / store.target) * 100)}%;`} />
          </div>
        </div>

        {/* Selected combos */}
        <div style="background:#0d1117;border-radius:8px;padding:10px;flex:1;min-height:60px;">
          <div style="font-size:10px;color:#aaa;letter-spacing:1px;margin-bottom:6px;">ВЫБРАНО</div>
          {selectedCombos().length === 0
            ? <div style="font-size:11px;color:#333;">—</div>
            : selectedCombos().map((c, i) => (
                <div key={i} style="background:#1e3a5f;border-radius:3px;padding:4px 6px;font-size:11px;color:#93c5fd;margin-bottom:3px;">
                  {c.type === 'straight'
                    ? '1-2-3-4-5 = '
                    : c.type === 'triple'
                      ? `${c.face}×3 = `
                      : `${c.face} = `}
                  <span style="color:#fbbf24;">{c.points}</span>
                </div>
              ))
          }
          {selectedPoints() > 0 && (
            <div style="margin-top:6px;padding-top:6px;border-top:1px solid #1e293b;display:flex;justify-content:space-between;font-size:11px;">
              <span style="color:#aaa;">Итого</span>
              <span style="color:#fbbf24;font-weight:bold;">{selectedPoints()}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style="display:flex;flex-direction:column;gap:6px;">
          {phase.value === 'farkle' && farkleButtonVisible.value && (
            <button
              style="width:100%;padding:9px;font-size:12px;background:#7f1d1d;color:#fca5a5;border:none;border-radius:6px;cursor:pointer;"
              onClick$={() => { controllerRef.value?.startNextTurn(); }}
            >
              → Следующий ход
            </button>
          )}

          {phase.value === 'hot-dice' && (
            <>
              <button
                style="width:100%;padding:9px;font-size:12px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;"
                onClick$={async () => {
                  controllerRef.value?.startNextTurn();
                  await controllerRef.value?.roll([0, 1, 2, 3, 4, 5]);
                }}
              >
                🎲 Бросить все 6
              </button>
              <button
                style="width:100%;padding:9px;font-size:12px;background:#15803d;color:#fff;border:none;border-radius:6px;cursor:pointer;"
                onClick$={() => { controllerRef.value?.bankTurn(); }}
              >
                ✓ Завершить
              </button>
            </>
          )}

          {(phase.value === 'idle' || phase.value === 'selecting') && (
            <>
              <button
                style={`width:100%;padding:9px;font-size:12px;border:none;border-radius:6px;cursor:pointer;background:${phase.value === 'idle' ? '#1d4ed8' : (hasSelection() ? '#1d4ed8' : '#1e3a5f')};color:#fff;`}
                onClick$={async () => {
                  if (!controllerRef.value) return;
                  if (phase.value === 'selecting' && hasSelection()) {
                    const remaining = activeDiceState().filter(d => !d.selected).map(d => d.meshIndex);
                    if (remaining.length > 0) {
                      await controllerRef.value?.commitAndRoll(remaining);
                    }
                  } else if (phase.value === 'idle') {
                    await controllerRef.value?.roll(activeMeshIndices());
                  }
                }}
              >
                🎲 {phase.value === 'idle' ? `Бросить все (${activeMeshIndices().length})` : `Бросить снова (${activeDiceState().filter(d => !d.selected).length})`}
              </button>

              <button
                style={`width:100%;padding:9px;font-size:12px;border:none;border-radius:6px;cursor:${store.turnScore > 0 ? 'pointer' : 'default'};background:${store.turnScore > 0 ? '#15803d' : '#0f2a1a'};color:${store.turnScore > 0 ? '#fff' : '#1a3a1a'};`}
                onClick$={() => {
                  if (store.turnScore > 0) controllerRef.value?.bankTurn();
                }}
              >
                ✓ Завершить ход
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
