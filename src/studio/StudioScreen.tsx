// src/studio/StudioScreen.tsx
import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import type { StudioSceneHandle } from './StudioScene';

export const StudioScreen = component$(() => {
  const canvasRef = useSignal<HTMLCanvasElement>();
  const sceneHandle = useSignal<StudioSceneHandle | null>(null);
  const diceCount = useSignal(2);
  const isRecording = useSignal(false);
  const status = useSignal('');
  const library = useSignal<Record<string, string[]>>({});

  const refreshLibrary = $(async () => {
    try {
      const res = await fetch('/animations/manifest.json?t=' + Date.now());
      if (res.ok) library.value = await res.json();
    } catch { /* ignore */ }
  });

  useVisibleTask$(async () => {
    if (!canvasRef.value) return;
    const { initStudioScene } = await import('./StudioScene');
    sceneHandle.value = await initStudioScene(canvasRef.value);
    await refreshLibrary();
  });

  return (
    <div style="display:flex;height:100vh;background:#0d1117;color:#fff;font-family:sans-serif;">
      {/* 3D canvas */}
      <div style="flex:1;position:relative;">
        <canvas ref={canvasRef} style="width:100%;height:100%;" />
      </div>

      {/* Right panel */}
      <div style="width:220px;background:#0f172a;padding:16px;display:flex;flex-direction:column;gap:12px;">
        <div style="font-size:14px;font-weight:bold;">🎲 Animation Studio</div>

        {/* Dice count selector */}
        <div>
          <div style="font-size:11px;color:#aaa;margin-bottom:6px;">КУБИКОВ</div>
          <div style="display:flex;gap:4px;">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                style={`padding:4px 8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:${diceCount.value === n ? '#2563eb' : '#222'};color:#fff;`}
                onClick$={async () => {
                  diceCount.value = n;
                  await sceneHandle.value?.setDiceCount(n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button
            style={`padding:8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:${isRecording.value ? '#dc2626' : '#1d4ed8'};color:#fff;`}
            onClick$={() => {
              if (!isRecording.value) {
                sceneHandle.value?.startRecording();
                isRecording.value = true;
                status.value = 'Запись...';
              }
            }}
          >
            {isRecording.value ? '⏺ Идёт запись...' : '▶ Запустить + Записать'}
          </button>

          <button
            disabled={!isRecording.value}
            style={`padding:8px;font-size:12px;border-radius:4px;border:none;cursor:${isRecording.value ? 'pointer' : 'default'};background:#15803d;color:#fff;opacity:${isRecording.value ? '1' : '0.4'};`}
            onClick$={async () => {
              if (!isRecording.value) return;
              isRecording.value = false;
              status.value = 'Сохранение...';
              const data = await sceneHandle.value?.stopAndSave();
              status.value = data ? `Сохранено! Граней: [${data.finalFaces.join(',')}]` : 'Ошибка сохранения';
              if (data) await refreshLibrary();
            }}
          >
            💾 Стоп и Сохранить
          </button>

          <button
            style="padding:8px;font-size:12px;border-radius:4px;border:none;cursor:pointer;background:#333;color:#fff;"
            onClick$={async () => {
              isRecording.value = false;
              status.value = '';
              await sceneHandle.value?.reset();
            }}
          >
            🗑 Сбросить
          </button>
        </div>

        {/* Status */}
        {status.value && (
          <div style="font-size:11px;color:#4ade80;background:#0a1f0a;padding:8px;border-radius:4px;">
            {status.value}
          </div>
        )}

        {/* Library */}
        <div style="flex:1;overflow-y:auto;">
          <div style="font-size:11px;color:#aaa;letter-spacing:1px;margin-bottom:6px;">БИБЛИОТЕКА</div>
          {Object.entries(library.value).length === 0
            ? <div style="font-size:11px;color:#333;">Нет записей</div>
            : Object.entries(library.value).map(([key, files]) => (
                <div key={key} style="margin-bottom:8px;">
                  <div style="font-size:10px;color:#555;margin-bottom:3px;">{key}</div>
                  {(files as string[]).map(f => (
                    <div key={f} style="font-size:10px;color:#888;padding:2px 4px;background:#111;border-radius:2px;margin-bottom:2px;">
                      {f}
                    </div>
                  ))}
                </div>
              ))
          }
        </div>
      </div>
    </div>
  );
});
