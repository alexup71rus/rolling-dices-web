import {
  $,
  component$,
  noSerialize,
  type NoSerialize,
  useSignal,
  useVisibleTask$,
} from "@builder.io/qwik";
import { initSceneWrapper } from "../diceLogic/diceLogic";
import { SpecialDiceModal } from "./SpecialDiceModal";
import "./DiceScene.css";

type SpecialDiceEntry = { face: number; attempts: number };
type SceneApi = ReturnType<typeof initSceneWrapper>;

export const DiceScene = component$(() => {
  const sceneApi = useSignal<NoSerialize<SceneApi>>();
  const canvasRef = useSignal<HTMLCanvasElement>();
  const selectedDice = useSignal<{ index: number; value: number }[]>([]);
  const setAsideResults = useSignal<number[]>([]);
  const isShowModal = useSignal(false);

  // Загружаем настройки особых кубиков из localStorage
  const specialDiceSettings = useSignal<SpecialDiceEntry[]>(
    JSON.parse(localStorage.getItem("specialDiceSettings") || "[]"),
  );

  const saveSpecialDiceSettings = $((newSettings: SpecialDiceEntry[]) => {
    specialDiceSettings.value = newSettings;
    localStorage.setItem("specialDiceSettings", JSON.stringify(newSettings));
    isShowModal.value = false;
  });

  useVisibleTask$(({ track }) => {
    track(() => canvasRef.value);

    if (canvasRef.value) {
      const api = initSceneWrapper(
        canvasRef.value,
        {
          onDiceClick: (index: number, value: number) => {
            if (!selectedDice.value.some((d) => d.index === index)) {
              selectedDice.value = [...selectedDice.value, { index, value }];
            } else {
              selectedDice.value = selectedDice.value.filter(
                (d) => d.index !== index,
              );
            }
          },
        },
      );
      sceneApi.value = noSerialize(api);
    }
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }}></canvas>

      <div class="action-panel">
        <button onClick$={() => sceneApi.value?.rollAllDice()}>
          Бросить все кубики
        </button>

        <button
          onClick$={() => {
            if (sceneApi.value) {
              setAsideResults.value = sceneApi.value.setAsideSelectedDice();
              selectedDice.value = [];
            }
          }}
          disabled={selectedDice.value.length === 0}
        >
          Отложить выбранные
        </button>

        <button onClick$={() => (isShowModal.value = true)}>
          Настроить особые кубики
        </button>
      </div>

      {/* Отображение отложенных кубиков */}
      {setAsideResults.value.length > 0 && (
        <div>Вы отложили: {setAsideResults.value.join(", ")}</div>
      )}

      {isShowModal.value && (
        <SpecialDiceModal
          onSave$={saveSpecialDiceSettings}
        />
      )}
    </div>
  );
});
