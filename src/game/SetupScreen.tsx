// src/game/SetupScreen.tsx
import { component$, useContext, useStore } from '@builder.io/qwik';
import { GameContext } from './gameState';
import type { DieType } from './diceModifiers';

const DIE_TYPES: { type: DieType; icon: string; label: string; description: string }[] = [
  { type: 'normal',   icon: '⚀', label: 'Обычный',      description: 'Равные шансы' },
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
      <div style="background:#0f172a;border-radius:12px;padding:24px;width:480px;color:#fff;font-family:sans-serif;">
        <h2 style="margin:0 0 20px;font-size:18px;">🎲 Новая игра</h2>

        {/* Goal */}
        <div style="margin-bottom:20px;">
          <div style="font-size:11px;color:#aaa;letter-spacing:1px;margin-bottom:8px;">ЦЕЛЬ</div>
          <div style="display:flex;gap:8px;">
            {TARGETS.map(t => (
              <div
                key={t}
                style={`flex:1;background:${store.target === t ? '#1a1a2e' : '#111'};border:${store.target === t ? '2px solid #2563eb' : '1px solid #333'};border-radius:8px;padding:10px;text-align:center;cursor:pointer;`}
                onClick$={() => { store.target = t as 2000 | 3000 | 4000; }}
              >
                <div style={`font-size:18px;font-weight:bold;color:${store.target === t ? '#4fc3f7' : '#555'};`}>{t.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dice configurator */}
        <div style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:11px;color:#aaa;letter-spacing:1px;">КУБИКИ</div>
            <div style="font-size:12px;color:#4fc3f7;">{Object.values(counts).reduce((s, n) => s + n, 0)} / 6</div>
          </div>

          {DIE_TYPES.map(({ type, icon, label, description }) => (
            <div key={type} style={`background:${type === 'normal' ? '#111' : '#1a1a2e'};border:1px solid ${type === 'normal' ? '#222' : '#333'};border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:10px;`}>
              <span style="font-size:20px;">{icon}</span>
              <div style="flex:1;">
                <div style={`font-size:12px;color:${type === 'normal' ? '#555' : '#fff'};`}>{label}</div>
                <div style="font-size:10px;color:#444;">{type === 'normal' ? 'Автозаполнение' : description}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span
                  style={`font-size:18px;padding:0 6px;cursor:${type === 'normal' ? 'default' : 'pointer'};color:${type === 'normal' ? '#333' : '#4fc3f7'};`}
                  onClick$={() => {
                    if (type === 'normal') return;
                    if (counts[type] <= 0) return;
                    counts[type]--;
                    const nextNonNormal =
                      counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    counts['normal'] = 6 - nextNonNormal;
                  }}
                >−</span>
                <span style={`font-size:16px;min-width:18px;text-align:center;color:${type === 'normal' ? '#555' : '#fff'};font-weight:bold;`}>
                  {counts[type]}
                </span>
                <span
                  style={`font-size:18px;padding:0 6px;cursor:${type === 'normal' || nonNormalCount >= 6 ? 'default' : 'pointer'};color:${type === 'normal' || (nonNormalCount >= 6 && counts[type] === 0) ? '#333' : '#4fc3f7'};`}
                  onClick$={() => {
                    if (type === 'normal') return;
                    const currentNonNormal =
                      counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    if (currentNonNormal >= 6) return;
                    counts[type]++;
                    const nextNonNormal =
                      counts['biased-1'] + counts['biased-5'] + counts['lucky'] + counts['unlucky'];
                    counts['normal'] = 6 - nextNonNormal;
                  }}
                >+</span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary icons */}
        <div style="display:flex;gap:8px;justify-content:center;padding:10px;background:#0d1117;border-radius:6px;margin-bottom:16px;font-size:24px;">
          {summaryIcons().map((icon, i) => <span key={i}>{icon}</span>)}
        </div>

        {/* Start button */}
        <button
          style="width:100%;padding:12px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;"
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
          ▶ Начать игру
        </button>
      </div>
    </div>
  );
});
