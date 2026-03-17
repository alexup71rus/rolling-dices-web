import { $, component$, type PropFunction, useSignal } from "@builder.io/qwik";
import "./SpecialDiceModal.css";

type SpecialDiceEntry = { face: number; attempts: number };

type SpecialDiceModalProps = {
  onSave$: PropFunction<(data: SpecialDiceEntry[]) => void>;
};

export const SpecialDiceModal = component$<SpecialDiceModalProps>(({ onSave$ }) => {
  const specialDice = useSignal<SpecialDiceEntry[]>([{ face: 1, attempts: 1 }]);

  const addDice = $(() => {
    specialDice.value = [...specialDice.value, { face: 1, attempts: 1 }];
  });

  const removeDice = $((index: number) => {
    specialDice.value = specialDice.value.filter((_, i) => i !== index);
  });

  const updateDice = $((index: number, key: keyof SpecialDiceEntry, value: number) => {
    const updated = [...specialDice.value];
    updated[index][key] = value;
    specialDice.value = updated;
  });

  return (
    <div class="modal">
      <div class="modal-content">
        <h2>Настройка особых кубиков</h2>
        {specialDice.value.map((dice, index) => (
          <div key={index} class="dice-row">
            <label>
              Сторона:
              <input
                type="number"
                min="1"
                max="6"
                value={dice.face}
                onInput$={(e) => {
                  const input = e.target as HTMLInputElement;
                  updateDice(index, "face", Number.parseInt(input.value, 10));
                }}
              />
            </label>
            <label>
              Попытки:
              <input
                type="number"
                min="1"
                value={dice.attempts}
                onInput$={(e) => {
                  const input = e.target as HTMLInputElement;
                  updateDice(index, "attempts", Number.parseInt(input.value, 10));
                }}
              />
            </label>
            <button onClick$={() => removeDice(index)}>Удалить</button>
          </div>
        ))}
        <button onClick$={addDice}>Добавить кубик</button>
        <button
          onClick$={() => {
            onSave$(specialDice.value);
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
});
