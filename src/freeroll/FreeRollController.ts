import type { SceneRefs } from '../scene/sceneSetup';
import type { DiceMeshEntry } from '../scene/DiceRenderer';
import type { DieType } from '../game/diceModifiers';
import { createDie, performRoll, buildModifiersFromConfig } from '../game/diceModifiers';
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
  diceConfig?: DieType[],
): Promise<FreeRollController> {
  const refs: SceneRefs = await initScene(canvas);
  const { scene, world, renderer, camera } = refs;

  let entries: DiceMeshEntry[] = await createDiceEntries(diceCount, scene, world);
  let rolling = false;

  const config = diceConfig && diceConfig.length === diceCount
    ? diceConfig
    : Array.from({ length: diceCount }, () => 'normal' as DieType);
  const dice = config.map(t => createDie(t));
  const modifiers = buildModifiersFromConfig(config);

  let rafId: number;
  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  }
  renderLoop();

  async function roll(): Promise<number[]> {
    if (rolling) return [];
    rolling = true;

    const values = performRoll(dice, modifiers);

    const animData = await pickAnimation(diceCount).catch(() => null);
    if (animData) {
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
