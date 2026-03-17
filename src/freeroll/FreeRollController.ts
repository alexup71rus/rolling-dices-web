// src/freeroll/FreeRollController.ts
import type { SceneRefs } from '../scene/sceneSetup';
import type { DiceMeshEntry } from '../scene/DiceRenderer';
import { pickAnimation } from '../animation/animationLibrary';
import { playAnimation } from '../animation/AnimationPlayer';
import { initScene, disposeScene } from '../scene/sceneSetup';
import { createDiceEntries, removeDiceFromScene } from '../scene/DiceRenderer';

export interface FreeRollController {
  roll: () => Promise<number[]>;
  dispose: () => void;
}

export async function createFreeRollController(
  canvas: HTMLCanvasElement,
  diceCount: number,
): Promise<FreeRollController> {
  const refs: SceneRefs = await initScene(canvas);
  const { scene, world, renderer, camera } = refs;

  let entries: DiceMeshEntry[] = await createDiceEntries(diceCount, scene, world);
  let rolling = false;

  let rafId: number;
  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  }
  renderLoop();

  async function roll(): Promise<number[]> {
    if (rolling) return [];
    rolling = true;

    // Generate random values 1-6 for each die
    const values = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);

    const animData = await pickAnimation(diceCount).catch(() => null);
    if (animData) {
      // Use as many entries as the animation supports
      const animCount = Math.min(diceCount, animData.diceCount);
      const activeEntries = entries.slice(0, animCount);
      const activeValues = values.slice(0, animCount);
      await playAnimation(animData, activeValues, activeEntries, () => {}).promise;
    }

    rolling = false;
    return values;
  }

  function dispose() {
    cancelAnimationFrame(rafId);
    removeDiceFromScene(entries, scene, world);
    disposeScene(refs);
  }

  return { roll, dispose };
}
