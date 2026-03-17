import { component$, noSerialize, useContext, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from './gameState';
import { detectCombinations, scoreCombinations } from './scoring';
import type { TurnPhase } from './GameSceneController';
import type { GameSceneController } from './GameSceneController';
import './GameScreen.css';

export const GameScreen = component$(() => {
  const store = useContext(GameContext);
  const canvasRef = useSignal<HTMLCanvasElement>();
  const phase = useSignal<TurnPhase>('idle');
  const farkleButtonVisible = useSignal(false);
  const controllerRef = useSignal<any>(null);
  const sceneError = useSignal<string>('');

  useVisibleTask$(async ({ cleanup }) => {
    if (!canvasRef.value) return;
    let ctrl: GameSceneController | null = null;
    try {
      const { createGameSceneController } = await import('./GameSceneController');
      ctrl = await createGameSceneController(
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
      controllerRef.value = noSerialize(ctrl);
    } catch (err) {
      sceneError.value = err instanceof Error ? err.message : 'Failed to initialize 3D scene';
      phase.value = 'idle';
      controllerRef.value = null;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!ctrl) return;
      const p = ctrl.getPhase();
      const isSelecting = p === 'selecting' || p === 'hot-dice';

      if (e.key === 'Escape' && isSelecting) {
        e.preventDefault();
        ctrl.deselectAll();
        return;
      }

      if ((e.key === 'ArrowLeft' || e.code === 'KeyA') && isSelecting) {
        e.preventDefault();
        ctrl.moveFocus('left');
        return;
      }
      if ((e.key === 'ArrowRight' || e.code === 'KeyD') && isSelecting) {
        e.preventDefault();
        ctrl.moveFocus('right');
        return;
      }
      if ((e.key === 'ArrowUp' || e.code === 'KeyW') && isSelecting) {
        e.preventDefault();
        ctrl.moveFocus('up');
        return;
      }
      if ((e.key === 'ArrowDown' || e.code === 'KeyS') && isSelecting) {
        e.preventDefault();
        ctrl.moveFocus('down');
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && isSelecting) {
        e.preventDefault();
        ctrl.toggleFocusedSelection();
        return;
      }

      if (e.code === 'KeyN') {
        e.preventDefault();
        store.screen = 'setup';
        return;
      }

      if (e.code === 'KeyE' && (p === 'idle' || isSelecting)) {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('.btn-roll:not(.btn-disabled)')?.click();
        return;
      }

      if (e.code === 'KeyF') {
        if (isSelecting) {
          e.preventDefault();
          document.querySelector<HTMLButtonElement>('.btn-bank:not(.btn-disabled)')?.click();
          return;
        }
        if (p === 'farkle' && farkleButtonVisible.value) {
          e.preventDefault();
          ctrl.startNextTurn();
          return;
        }
      }

      if (p === 'farkle' && farkleButtonVisible.value) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          ctrl.startNextTurn();
          return;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);

    cleanup(() => {
      window.removeEventListener('keydown', onKeyDown);
      ctrl?.dispose?.();
      controllerRef.value = null;
    });
  });

  // Derive active/set-aside dice
  const activeDiceState = store.diceState.filter(d => !d.setAside);
  const setAsideDice = store.diceState.filter(d => d.setAside);
  const activeMeshIndices = activeDiceState.map(d => d.meshIndex);
  const anySelected = activeDiceState.some(d => d.selected);

  const selectedCombos = (() => {
    const selectedDice = activeDiceState.filter(d => d.selected);
    const selectedValues = selectedDice.map(d => d.value);
    if (selectedValues.length === 0 || selectedValues.every(v => v === 0)) return [];
    return detectCombinations(selectedValues);
  })();

  const coveredIndices = new Set(selectedCombos.flatMap(c => c.diceIndices));
  const selectedCount = activeDiceState.filter(d => d.selected).length;
  const allSelectedCovered = selectedCount > 0 && coveredIndices.size === selectedCount;
  const selectedPoints = allSelectedCovered ? scoreCombinations(selectedCombos) : 0;
  const hasValidSelection = allSelectedCovered && selectedPoints > 0;

  // Treat hot-dice the same as selecting for UI purposes
  const isSelecting = phase.value === 'selecting' || phase.value === 'hot-dice';

  const specialDiceTestMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('test-special-dice-100') === '1';

  return (
    <div class="game-root">
      {/* 3D canvas */}
      <div class="scene-area">
        <canvas ref={canvasRef} class="scene-canvas" />

        {sceneError.value && (
          <div class="overlay scene-error">3D scene error: {sceneError.value}</div>
        )}

        {specialDiceTestMode && (
          <div class="overlay test-mode-badge">
            TEST MODE: шанс выпадения в шулерских костях всегда 100%
          </div>
        )}

        {setAsideDice.length > 0 && (
          <div class="overlay set-aside-strip">
            <span class="set-aside-label">Отложено</span>
            {setAsideDice.map(d => (
              <div key={d.meshIndex} class="set-aside-die">
                <div class="set-aside-die-icon">
                  {['⚀','⚁','⚂','⚃','⚄','⚅'][d.value - 1] ?? '⚀'}
                </div>
                <div class="set-aside-die-pts">{d.scoreContribution}</div>
              </div>
            ))}
          </div>
        )}

        {phase.value === 'farkle' && (
          <div class="overlay farkle-banner">
            <div class="farkle-title">💀 Неудача!</div>
            <div class="farkle-sub">Очки за ход сгорают</div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div class="panel">
        <div class="top-bar">
          <h1 class="panel-title">Стол</h1>
          <button
            class="btn-new-game"
            onClick$={() => {
              store.screen = 'setup';
            }}
          >
            Новая игра <kbd class="kbd-hint">N</kbd>
          </button>
        </div>

        {/* Scores */}
        <div class="score-card">
          <div class="score-label">Очки за ход</div>
          <div class="score-turn">{store.turnScore}</div>
          <div class="score-divider" />
          <div class="score-label">Всего</div>
          <div class="score-total">{store.totalScore.toLocaleString()}</div>
          <div class="score-divider" />
          <div class="score-target-row">
            <span class="score-target-label">Цель</span>
            <span class="score-target-value">{store.target.toLocaleString()}</span>
          </div>
          <div class="progress-track">
            <div
              class="progress-fill"
              style={`width:${Math.min(100, (store.totalScore / store.target) * 100)}%`}
            />
          </div>
        </div>

        {/* Selected combos */}
        <div class="selection-card">
          <div class="selection-label">Выбрано</div>
          {selectedCombos.length === 0
            ? <div class="selection-empty">{anySelected && !allSelectedCovered ? 'Невалидный выбор' : '—'}</div>
            : selectedCombos.map((c, i) => (
                <div key={i} class="combo-chip">
                  <span>
                    {c.type === 'straight'
                      ? '1-2-3-4-5'
                      : c.type === 'triple'
                        ? `${c.face} × 3`
                        : `${c.face}`}
                  </span>
                  <span class="combo-pts">{c.points}</span>
                </div>
              ))
          }
          {selectedPoints > 0 && (
            <div class="selection-total-row">
              <span class="selection-total-label">Итого</span>
              <span class="selection-total-value">{selectedPoints}</span>
            </div>
          )}
          {anySelected && !allSelectedCovered && (
            <div class="selection-warning">Снимите выделение с неочковых кубиков</div>
          )}
        </div>

        {/* Action buttons */}
        <div class="btn-group">
          {phase.value === 'farkle' && farkleButtonVisible.value && (
            <button
              class="btn btn-farkle"
              onClick$={() => { controllerRef.value?.startNextTurn(); }}
            >
              → Следующий ход <kbd class="kbd-hint">F</kbd>
            </button>
          )}

          {(phase.value === 'idle' || isSelecting) && (
            <>
              <button
                class={`btn btn-roll ${phase.value !== 'idle' && !hasValidSelection ? 'btn-disabled' : ''}`}
                onClick$={async () => {
                  if (!controllerRef.value) return;
                  if (isSelecting) {
                    if (!hasValidSelection) return;
                    const active = store.diceState.filter(d => !d.setAside);
                    const remaining = active.filter(d => !d.selected).map(d => d.meshIndex);
                    await controllerRef.value?.commitAndRoll(remaining);
                  } else if (phase.value === 'idle') {
                    const activeMesh = store.diceState.filter(d => !d.setAside).map(d => d.meshIndex);
                    await controllerRef.value?.roll(activeMesh);
                  }
                }}
              >
                🎲 {phase.value === 'idle'
                  ? `Бросить все (${activeMeshIndices.length})`
                  : activeDiceState.every(d => d.selected)
                    ? `Бросить все (${store.diceState.length})`
                    : `Бросить снова (${activeDiceState.filter(d => !d.selected).length})`}
                {' '}<kbd class="kbd-hint">E</kbd>
              </button>

              <button
                class={`btn btn-bank ${!(store.turnScore > 0 || hasValidSelection) ? 'btn-disabled' : ''}`}
                onClick$={() => {
                  if (store.turnScore > 0 || hasValidSelection) controllerRef.value?.bankTurn();
                }}
              >
                ✓ Завершить ход <kbd class="kbd-hint">F</kbd>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
