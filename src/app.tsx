import { component$ } from "@builder.io/qwik";
import { DiceScene } from "./components/DiceScene.tsx";

export const App = component$(() => {
  return (
    <div>
      <DiceScene />
    </div>
  );
});
