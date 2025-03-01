import {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useTask$,
} from "@builder.io/qwik";
import { initSceneWrapper } from "../diceLogic/diceLogic";
import { SpecialDiceModal } from "./SpecialDiceModal";

export const DiceScene = component$(() => {
  const rollDiceFn = useSignal<(() => void) | null>(null);
  const setAsideFn = useSignal<(() => number[]) | null>(null);
  const canvasRef = useSignal<HTMLCanvasElement | null>(null);
  const selectedDice = useSignal<{ index: number; value: number }[]>([]);
  const setAsideResults = useSignal<number[]>([]);
  const isShowModal = useSignal(false);

  // Загружаем настройки особых кубиков из localStorage
  const specialDiceSettings = useSignal<{ face: number; attempts: number }[]>(
    JSON.parse(localStorage.getItem("specialDiceSettings") || "[]"),
  );

  // Функция для обновления настроек и их сохранения в localStorage
  const updateSpecialDiceSettings = $(
    (newSettings: { face: number; attempts: number }[]) => {
      specialDiceSettings.value = newSettings;
      localStorage.setItem("specialDiceSettings", JSON.stringify(newSettings));
    },
  );

  useVisibleTask$(({ track }) => {
    track(() => canvasRef.value);
    track(() => specialDiceSettings.value); // Отслеживаем обновления настроек

    if (canvasRef.value) {
      const { rollAllDice, setAsideSelectedDice } = initSceneWrapper(
        canvasRef.value,
        {
          onDiceClick: (index: number, value: number) => {
            if (!selectedDice.value.some((d) => d.index === index)) {
              selectedDice.value = [...selectedDice.value, { index, value }];
            }
          },
        },
      );
      rollDiceFn.value = () => rollAllDice(specialDiceSettings.value); // Передаем настройки при броске
      setAsideFn.value = setAsideSelectedDice;
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

      <button
        onClick$={() => rollDiceFn.value?.()}
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          zIndex: "10",
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Бросить все кубики
      </button>

      {/* Кнопка "Настроить особые кубики" */}
      <button
        onClick$={() => (isShowModal.value = true)}
        style={{
          position: "absolute",
          top: "10px",
          left: "150px",
          zIndex: "10",
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Настроить особые кубики
      </button>

      {selectedDice.value.length > 0 && (
        <button
          onClick$={() => {
            if (setAsideFn.value) {
              setAsideResults.value = setAsideFn.value();
              selectedDice.value = [];
            }
          }}
          style={{
            position: "absolute",
            top: "50px",
            left: "10px",
            zIndex: "10",
            padding: "10px 20px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Отложить выбранные
        </button>
      )}

      {/* Отображение отложенных кубиков */}
      {setAsideResults.value.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "90px",
            left: "10px",
            zIndex: "10",
            background: "rgba(255,255,255,0.8)",
            padding: "10px",
            borderRadius: "5px",
          }}
        >
          Вы отложили: {setAsideResults.value.join(", ")}
        </div>
      )}

      {isShowModal.value && (
        <SpecialDiceModal
          onSave={(data) => {
            updateSpecialDiceSettings(data);
            isShowModal.value = false;
          }}
        />
      )}
    </div>
  );
});
