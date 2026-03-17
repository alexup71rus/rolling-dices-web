import { component$, useContext, useSignal, useStore, useVisibleTask$ } from '@builder.io/qwik';
import { GameContext } from '../game/gameState';
import type { DieType } from '../game/diceModifiers';

const DIE_TYPES: { type: DieType; icon: string; label: string; description: string }[] = [
  { type: 'normal',   icon: '🎲', label: 'Обычный',      description: 'Равные шансы' },
  { type: 'biased-1', icon: '🎯', label: 'На единицу',   description: '×3 шанс на 1' },
  { type: 'biased-5', icon: '🎯', label: 'На пятёрку',   description: '×3 шанс на 5' },
  { type: 'lucky',    icon: '🍀', label: 'Счастливый',   description: '+20% к нужной' },
  { type: 'unlucky',  icon: '💀', label: 'Несчастливый', description: '−20% от нужной' },
];

export const FreeRollSetupScreen = component$(() => {
  const store = useContext(GameContext);
  const counts = useStore<Record<DieType, number>>({
    'normal': store.freerollDiceCount, 'biased-1': 0, 'biased-5': 0, 'lucky': 0, 'unlucky': 0,
  });
  const focusedRow = useSignal(-1);

  useVisibleTask$(({ cleanup }) => {
    const clampAndRecalc = () => {
      let nn = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
      if (nn > store.freerollDiceCount) {
        for (const type of ['unlucky', 'lucky', 'biased-5', 'biased-1'] as DieType[]) {
          if (nn <= store.freerollDiceCount) break;
          const reduce = Math.min(counts[type], nn - store.freerollDiceCount);
          counts[type] -= reduce;
          nn -= reduce;
        }
      }
      counts['normal'] = store.freerollDiceCount - (counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky']);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.querySelector<HTMLButtonElement>('.freeroll-start-btn')?.click();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedRow.value = Math.min(focusedRow.value + 1, DIE_TYPES.length - 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedRow.value = Math.max(focusedRow.value - 1, -1);
        return;
      }

      if (focusedRow.value >= 0) {
        const dieType = DIE_TYPES[focusedRow.value].type;
        if (dieType !== 'normal') {
          if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
            e.preventDefault();
            if (counts[dieType] > 0) {
              counts[dieType]--;
              clampAndRecalc();
            }
            return;
          }
          if (e.key === 'ArrowRight' || e.code === 'KeyD') {
            e.preventDefault();
            const nn = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
            if (nn < store.freerollDiceCount) {
              counts[dieType]++;
              clampAndRecalc();
            }
            return;
          }
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        if (store.freerollDiceCount > 1) {
          store.freerollDiceCount--;
          clampAndRecalc();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        if (store.freerollDiceCount < 6) {
          store.freerollDiceCount++;
          clampAndRecalc();
        }
        return;
      }

      if (e.key === 'Escape') {
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
          <span style="font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">🎲</span> Бросок кубиков
        </h2>

        {/* Количество кубиков */}
        <div style="margin-bottom:24px;">
          <div style="font-size:12px;color:#d4d4d8;letter-spacing:1.5px;margin-bottom:14px;text-transform:uppercase;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);text-align:center;">Количество кубиков</div>
          <div style={`display:flex;align-items:center;justify-content:center;gap:20px;padding:8px;border-radius:10px;border:${focusedRow.value === -1 ? '1px solid rgba(251,191,36,0.6)' : '1px solid transparent'};background:${focusedRow.value === -1 ? 'rgba(217,119,6,0.15)' : 'transparent'};transition:all 0.15s ease;`}>
            <span
              style={`font-size:32px;cursor:${store.freerollDiceCount > 1 ? 'pointer' : 'default'};color:${store.freerollDiceCount > 1 ? '#fbbf24' : 'rgba(255,255,255,0.2)'};user-select:none;transition:transform 0.1s;padding:0 12px;`}
              onClick$={() => {
                if (store.freerollDiceCount <= 1) return;
                store.freerollDiceCount--;
                let nn = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                if (nn > store.freerollDiceCount) {
                  for (const type of ['unlucky', 'lucky', 'biased-5', 'biased-1'] as DieType[]) {
                    if (nn <= store.freerollDiceCount) break;
                    const reduce = Math.min(counts[type], nn - store.freerollDiceCount);
                    counts[type] -= reduce;
                    nn -= reduce;
                  }
                }
                counts['normal'] = store.freerollDiceCount - (counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky']);
              }}
              onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
              onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
              onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
            >−</span>
            <span style="font-size:48px;font-weight:800;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,0.5);min-width:60px;text-align:center;">
              {store.freerollDiceCount}
            </span>
            <span
              style={`font-size:32px;cursor:${store.freerollDiceCount < 6 ? 'pointer' : 'default'};color:${store.freerollDiceCount < 6 ? '#fbbf24' : 'rgba(255,255,255,0.2)'};user-select:none;transition:transform 0.1s;padding:0 12px;`}
              onClick$={() => {
                if (store.freerollDiceCount >= 6) return;
                store.freerollDiceCount++;
                counts['normal'] = store.freerollDiceCount - (counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky']);
              }}
              onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
              onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
              onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
            >+</span>
          </div>
        </div>

        {/* Кубики */}
        <div style="margin-bottom:24px;">
          <div style="margin-bottom:10px;">
            <div style="font-size:12px;color:#d4d4d8;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);">Кубики</div>
          </div>

          {DIE_TYPES.map(({ type, icon, label, description }, rowIdx) => (
            <div key={type} style={`background:${focusedRow.value === rowIdx ? 'rgba(217,119,6,0.3)' : type === 'normal' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)'};border:${focusedRow.value === rowIdx ? '1px solid rgba(251,191,36,0.6)' : '1px solid rgba(255,255,255,0.08)'};border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;transition:all 0.15s ease;`}>
              <span style="font-size:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));">{icon}</span>
              <div style="flex:1;">
                <div style={`font-size:14px;font-weight:500;color:${type === 'normal' ? '#d4d4d8' : '#fff'};text-shadow:0 1px 2px rgba(0,0,0,0.4);`}>{label}</div>
                <div style="font-size:11px;color:#a1a1aa;margin-top:2px;">{type === 'normal' ? 'Автозаполнение обычными' : description}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <span
                  style={`font-size:20px;padding:0 8px;cursor:${type === 'normal' ? 'default' : 'pointer'};color:${type === 'normal' ? 'rgba(255,255,255,0.2)' : '#fbbf24'};user-select:none;transition:transform 0.1s;`}
                  onClick$={() => {
                    if (type === 'normal') return;
                    if (counts[type] <= 0) return;
                    counts[type]--;
                    counts['normal'] = store.freerollDiceCount - (counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky']);
                  }}
                  onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
                  onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                  onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                >−</span>
                <span style={`font-size:18px;min-width:20px;text-align:center;color:${type === 'normal' ? '#d4d4d8' : '#fff'};font-weight:bold;text-shadow:0 1px 2px rgba(0,0,0,0.5);`}>
                  {counts[type]}
                </span>
                <span
                  style={`font-size:20px;padding:0 8px;cursor:${type === 'normal' || nonNormalCount >= store.freerollDiceCount ? 'default' : 'pointer'};color:${type === 'normal' || (nonNormalCount >= store.freerollDiceCount && counts[type] === 0) ? 'rgba(255,255,255,0.2)' : '#fbbf24'};user-select:none;transition:transform 0.1s;`}
                  onClick$={() => {
                    if (type === 'normal') return;
                    const nn = counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    if (nn >= store.freerollDiceCount) return;
                    counts[type]++;
                    counts['normal'] = store.freerollDiceCount - (nn + 1);
                  }}
                  onMouseDown$={(e) => (e.target as HTMLElement).style.transform='scale(0.9)'}
                  onMouseUp$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                  onMouseLeave$={(e) => (e.target as HTMLElement).style.transform='scale(1)'}
                >+</span>
              </div>
            </div>
          ))}
        </div>

        {/* Превью */}
        <div style="display:flex;gap:10px;justify-content:center;padding:12px;background:rgba(0,0,0,0.3);border-radius:10px;margin-bottom:24px;font-size:26px;box-shadow:inset 0 2px 6px rgba(0,0,0,0.5);">
          {summaryIcons().map((icon, i) => <span key={i} style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">{icon}</span>)}
        </div>

        <button
          class="freeroll-start-btn"
          style="width:100%;padding:16px;font-size:16px;background:linear-gradient(to bottom, #d97706, #b45309);color:#fff;border:1px solid #f59e0b;border-radius:10px;cursor:pointer;font-weight:bold;text-shadow:0 1px 3px rgba(0,0,0,0.4);box-shadow:0 4px 12px rgba(0,0,0,0.4);transition:all 0.2s ease;"
          onMouseOver$={(e) => (e.target as HTMLElement).style.filter='brightness(1.1)'}
          onMouseOut$={(e) => (e.target as HTMLElement).style.filter='brightness(1)'}
          onClick$={() => {
            const config: DieType[] = [];
            for (const { type } of DIE_TYPES) {
              for (let i = 0; i < counts[type]; i++) config.push(type);
            }
            store.diceConfig = config;
            store.screen = 'freeroll';
          }}
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
