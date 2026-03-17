// src/game/SetupScreen.tsx
import { component$, useContext, useSignal, useStore, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from './gameState';
import type { DieType } from './diceModifiers';

const DIE_TYPES: { type: DieType; icon: string; label: string; description: string }[] = [
  { type: 'normal',   icon: '🎲', label: 'Обычный',      description: 'Равные шансы' },
  { type: 'biased-1', icon: '🎯', label: 'На единицу',   description: '×3 шанс на 1' },
  { type: 'biased-5', icon: '🎯', label: 'На пятёрку',   description: '×3 шанс на 5' },
  { type: 'lucky',    icon: '🍀', label: 'Счастливый',   description: '+20% к нужной' },
  { type: 'unlucky',  icon: '💀', label: 'Несчастливый', description: '−20% от нужной' },
];

const TARGETS = [2000, 3000, 4000] as const;

export const SetupScreen = component$(() => {
  const store = useContext(GameContext);
  const counts = useStore<Record<DieType, number>>({
    'normal': 6, 'biased-1': 0, 'biased-5': 0, 'lucky': 0, 'unlucky': 0,
  });
  /** Index of the focused die-type row (-1 = none focused). */
  const focusedRow = useSignal(-1);

  useVisibleTask$(({ cleanup }) => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      // Enter — start game
      if (key === 'Enter') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('.setup-start-btn')?.click();
        return;
      }
      // Left/Right arrows — cycle target (when no row focused) or adjust count
      const targets: (2000 | 3000 | 4000)[] = [2000, 3000, 4000];
      const currentIdx = targets.indexOf(store.target);

      // Up/Down — navigate modifier rows
      if (key === 'ArrowDown') {
        e.preventDefault();
        focusedRow.value = Math.min(focusedRow.value + 1, DIE_TYPES.length - 1);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        focusedRow.value = Math.max(focusedRow.value - 1, -1);
        return;
      }

      // Left/Right — when a row is focused, adjust its count; otherwise cycle target
      if (focusedRow.value >= 0) {
        const dieType = DIE_TYPES[focusedRow.value].type;
        if (dieType !== 'normal') {
          if (key === 'ArrowLeft') {
            e.preventDefault();
            if (counts[dieType] > 0) {
              counts[dieType]--;
              const nn = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
              counts['normal'] = 6 - nn;
            }
            return;
          }
          if (key === 'ArrowRight') {
            e.preventDefault();
            const nn = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
            if (nn < 6) {
              counts[dieType]++;
              counts['normal'] = 6 - (nn + 1);
            }
            return;
          }
        }
        return; // consume arrow left/right even for normal row
      }

      if (key === 'ArrowLeft' && currentIdx > 0) {
        e.preventDefault();
        store.target = targets[currentIdx - 1];
        return;
      }
      if (key === 'ArrowRight' && currentIdx < targets.length - 1) {
        e.preventDefault();
        store.target = targets[currentIdx + 1];
        return;
      }

      // Escape — if row focused, clear focus; otherwise go back to mode-select
      if (key === 'Escape') {
        if (focusedRow.value >= 0) {
          focusedRow.value = -1;
        } else {
          store.screen = 'mode-select';
        }
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    cleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  const nonNormalCount =
    counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];

  const summaryIcons = () => {
    const icons: string[] = [];
    for (const { type, icon } of DIE_TYPES) {
      for (let i = 0; i < counts[type]; i++) icons.push(icon);
    }
    return icons;
  };

  return (
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;">
      <div style="background:rgba(43, 23, 7, 0.6);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.15);box-shadow:0 12px 40px rgba(0,0,0,0.5);border-radius:16px;padding:32px;width:480px;color:#fef3c7;">
        <h2 style="margin:0 0 24px;font-size:24px;text-align:center;font-weight:700;text-shadow:0 2px 4px rgba(0,0,0,0.5);letter-spacing:1px;display:flex;align-items:center;justify-content:center;gap:10px;">
          <span style="font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🎲</span> Зонк
        </h2>

        {/* Goal */}
        <div style="margin-bottom:24px;">
          <div style="font-size:12px;color:#d4d4d8;letter-spacing:1.5px;margin-bottom:10px;text-transform:uppercase;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);">Цель игры</div>
          <div style="display:flex;gap:12px;">
            {TARGETS.map(t => (
              <div
                key={t}
                style={`flex:1;background:${store.target === t ? 'rgba(217,119,6,.8)' : 'rgba(0,0,0,0.3)'};border:${store.target === t ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.1)'};border-radius:10px;padding:12px;text-align:center;cursor:pointer;transition:all 0.2s ease;`}
                onClick$={() => { store.target = t as 2000 | 3000 | 4000; }}
              >
                <div style={`font-size:20px;font-weight:700;color:${store.target === t ? '#fff' : '#a1a1aa'};text-shadow:0 1px 2px rgba(0,0,0,0.3);`}>{t.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dice configurator */}
        <div style="margin-bottom:24px;">
          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:#d4d4d8;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);">Кубики</div>
          </div>

          {DIE_TYPES.map(({ type, icon, label, description }, rowIdx) => (
            <div key={type} style={`background:${focusedRow.value === rowIdx ? 'rgba(217,119,6,0.3)' : type === 'normal' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)'};border:${focusedRow.value === rowIdx ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.08)'};border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;transition:all 0.15s ease;`}>
              <span style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">{icon}</span>
              <div style="flex:1;">
                <div style={`font-size:14px;font-weight:500;color:${type === 'normal' ? '#d4d4d8' : '#fff'};text-shadow:0 1px 2px rgba(0,0,0,0.4);`}>{label}</div>
                <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">{type === 'normal' ? 'Автозаполнение обычными кубиками' : description}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span
                  style={`font-size:20px;padding:0 8px;cursor:${type === 'normal' ? 'default' : 'pointer'};color:${type === 'normal' ? 'rgba(255,255,255,0.2)' : '#fbbf24'};user-select:none;transition:transform 0.1s;`}
                  onClick$={() => {
                    if (type === 'normal') return;
                    if (counts[type] <= 0) return;
                    counts[type]--;
                    const nextNonNormal = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    counts['normal'] = 6 - nextNonNormal;
                  }}
                  onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
                  onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                  onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                >−</span>
                <span style={`font-size:18px;min-width:20px;text-align:center;color:${type === 'normal' ? '#d4d4d8' : '#fff'};font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.5);`}>
                  {counts[type]}
                </span>
                <span
                  style={`font-size:20px;padding:0 8px;cursor:${type === 'normal' || nonNormalCount >= 6 ? 'default' : 'pointer'};color:${type === 'normal' || (nonNormalCount >= 6 && counts[type] === 0) ? 'rgba(255,255,255,0.2)' : '#fbbf24'};user-select:none;transition:transform 0.1s;`}
                  onClick$={() => {
                    if (type === 'normal') return;
                    const currentNonNormal = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    if (currentNonNormal >= 6) return;
                    counts[type]++;
                    const nextNonNormal = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    counts['normal'] = 6 - nextNonNormal;
                  }}
                  onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
                  onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                  onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                >+</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary icons */}
        <div style="display:flex;gap:10px;justify-content:center;padding:12px;background:rgba(0,0,0,0.3);border-radius:10px;margin-bottom:24px;font-size:26px;box-shadow:inset 0 2px 6px rgba(0,0,0,0.5);">
          {summaryIcons().map((icon, i) => <span key={i} style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">{icon}</span>)}
        </div>

        {/* Start button */}
        <button
          class="setup-start-btn"
          style="width:100%;padding:16px;font-size:16px;background:linear-gradient(to bottom, #d97706, #b45309);color:#fff;border:1px solid #f59e0b;border-radius:10px;cursor:pointer;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.4);box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all 0.2s ease;"
          onMouseOver$={(e) => (e.target as HTMLElement).style.filter='brightness(1.1)'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.filter='brightness(1)'}
          onClick$={() => {
            const config: DieType[] = [];
            for (const { type } of DIE_TYPES) {
              for (let i = 0; i < counts[type]; i++) config.push(type);
            }
            store.diceConfig = config;
            store.diceState = Array.from({ length: 6 }, (_, i) => ({
              value: 0, selected: false, setAside: false,
              scoreContribution: 0, dieType: store.diceConfig[i], meshIndex: i,
            }));
            store.totalScore = 0;
            store.turnScore = 0;
            store.screen = 'game';
          }}
        >
          ▶ Бросить кости <kbd style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:1px 6px;font-size:11px;margin-left:6px;font-family:system-ui;font-weight:600;">Enter</kbd>
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
