import { $, component$, useSignal } from "@builder.io/qwik";
import "./SpecialDiceModal.css";

export const SpecialDiceModal = component$(({ onSave }) => {
  const specialDice = useSignal([{ face: 1, attempts: 1 }]);

  const addDice = $(() => {
    specialDice.value = [...specialDice.value, { face: 1, attempts: 1 }];
  });

  const removeDice = $((index) => {
    specialDice.value = specialDice.value.filter((_, i) => i !== index);
  });

  const updateDice = $((index, key, value) => {
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
                onInput$={(e) =>
                  updateDice(index, "face", parseInt(e.target.value))
                }
              />
            </label>
            <label>
              Попытки:
              <input
                type="number"
                min="1"
                value={dice.attempts}
                onInput$={(e) =>
                  updateDice(index, "attempts", parseInt(e.target.value))
                }
              />
            </label>
            <button onClick$={() => removeDice(index)}>Удалить</button>
          </div>
        ))}
        <button onClick$={addDice}>Добавить кубик</button>
        <button
          onClick$={() => {
            onSave(specialDice.value);
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
});
