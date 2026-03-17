import { component$, useContext, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from '../game/gameState';

export const ModeSelectScreen = component$(() => {
  const store = useContext(GameContext);
  const selected = useSignal<0 | 1>(0);

  useVisibleTask$(({ cleanup }) => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      if (key === 'ArrowLeft' || key === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') {
        e.preventDefault();
        selected.value = selected.value === 0 ? 1 : 0;
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        if (selected.value === 0) {
          store.mode = 'zonk';
          store.screen = 'setup';
        } else {
          store.mode = 'freeroll';
          store.screen = 'freeroll-setup';
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  const cardBase = 'border-radius:14px;padding:28px 24px;cursor:pointer;transition:all 0.2s ease;text-align:center;flex:1;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;';
  const activeCard = 'background:rgba(217,119,6,0.5);border:2px solid rgba(251,191,36,0.7);box-shadow:0 0 20px rgba(217,119,6,0.3);';
  const inactiveCard = 'background:rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.1);';

  return (
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="background:rgba(43, 23, 7, 0.6);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.15);box-shadow:0 12px 40px rgba(0,0,0,0.5);border-radius:16px;padding:36px;width:520px;color:#fef3c7;">
        <h1 style="margin:0 0 8px;font-size:28px;text-align:center;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.5);letter-spacing:1px;display:flex;align-items:center;justify-content:center;gap:10px;">
          <span style="font-size:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🎲</span> Rolling Dices
        </h1>
        <div style="text-align:center;color:#a1a1aa;font-size:13px;margin-bottom:28px;">Выберите режим</div>

        <div style="display:flex;gap:16px;margin-bottom:24px;">
          {/* Zonk card */}
          <div
            style={`${cardBase}${selected.value === 0 ? activeCard : inactiveCard}`}
            onClick$={() => {
              selected.value = 0;
              store.mode = 'zonk';
              store.screen = 'setup';
            }}
            onMouseEnter$={() => { selected.value = 0; }}
          >
            <span style="font-size:44px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));">🎰</span>
            <div style="font-size:18px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.4);">Зонк</div>
            <div style="font-size:12px;color:#d4d4d8;line-height:1.5;">
              Полная игра с подсчётом очков, комбинациями и фарклами
            </div>
          </div>

          {/* Free roll card */}
          <div
            style={`${cardBase}${selected.value === 1 ? activeCard : inactiveCard}`}
            onClick$={() => {
              selected.value = 1;
              store.mode = 'freeroll';
              store.screen = 'freeroll-setup';
            }}
            onMouseEnter$={() => { selected.value = 1; }}
          >
            <span style="font-size:44px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));">🎲</span>
            <div style="font-size:18px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.4);">Бросок кубиков</div>
            <div style="font-size:12px;color:#d4d4d8;line-height:1.5;">
              Просто бросайте кубики для любой настольной игры
            </div>
          </div>
        </div>

        <div style="text-align:center;color:#71717a;font-size:12px;">
          ← / → для выбора, Enter для подтверждения
        </div>
      </div>
    </div>
  );
});
