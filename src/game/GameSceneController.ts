// src/game/GameSceneController.ts
import * as THREE from 'three';
import type { SceneRefs } from '../scene/sceneSetup';
import type { DiceMeshEntry } from '../scene/DiceRenderer';
import type { GameStore } from './gameState';
import type { DieType } from './diceModifiers';
import { createDie, performRoll, buildModifiersFromConfig } from './diceModifiers';
import { detectCombinations, isFarkle, isHotDice } from './scoring';
import { pickAnimation } from '../animation/animationLibrary';
import { playAnimation } from '../animation/AnimationPlayer';
import { initScene, disposeScene } from '../scene/sceneSetup';
import { createDiceEntries, removeDiceFromScene } from '../scene/DiceRenderer';

export type TurnPhase =
  | 'idle'         // waiting for first roll
  | 'rolling'      // animation playing
  | 'selecting'    // player choosing dice
  | 'farkle'       // farkle detected
  | 'hot-dice'     // hot dice — treated as selecting in UI
  | 'ended';       // turn banked, next turn starting

export interface GameSceneController {
  roll: (activeMeshIndices: number[]) => Promise<void>;
  commitAndRoll: (remainingMeshIndices: number[]) => Promise<void>;
  onDiceClick: (meshIndex: number) => void;
  bankTurn: () => void;
  startNextTurn: () => void;
  dispose: () => void;
}

export async function createGameSceneController(
  canvas: HTMLCanvasElement,
  store: GameStore,
  onPhaseChange: (phase: TurnPhase) => void,
): Promise<GameSceneController> {
  const refs: SceneRefs = await initScene(canvas);
  const { scene, world, renderer, camera } = refs;

  const dice = store.diceConfig.map((t: DieType) => createDie(t));
  const modifiers = buildModifiersFromConfig(store.diceConfig);
  let entries: DiceMeshEntry[] = await createDiceEntries(6, scene, world);
  let currentPhase: TurnPhase = 'idle';

  // Render loop (no physics — physics only during recording in studio)
  let rafId: number;
  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  }
  renderLoop();

  function setPhase(p: TurnPhase) {
    currentPhase = p;
    onPhaseChange(p);
  }

  /** Resets emissive highlight on every die mesh. */
  function clearAllHighlights() {
    for (const entry of entries) {
      const mats = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
      mats.forEach((m: any) => { if (m.emissive) m.emissive.set(0x000000); });
    }
  }

  async function roll(activeMeshIndices: number[]) {
    if (currentPhase === 'rolling') return;
    setPhase('rolling');

    // Compute outcome
    const activeCount = activeMeshIndices.length;
    const activeDice = activeMeshIndices.map(i => dice[i]);
    const activeModifiers = modifiers.filter(m =>
      m.targetDiceIndices.some(i => activeMeshIndices.includes(i))
    );
    const values = performRoll(activeDice, activeModifiers);

    // Write rolled values into reactive store
    activeMeshIndices.forEach((meshIdx, vi) => {
      const d = store.diceState.find(d => d.meshIndex === meshIdx);
      if (d) { d.value = values[vi]; d.selected = false; }
    });

    // Pick and play animation
    const animData = await pickAnimation(activeCount).catch(() => null);
    if (animData) {
      const activeEntries = activeMeshIndices.map(i => entries[i]);
      await playAnimation(animData, values, activeEntries, () => {}).promise;
    }

    // Detect outcome
    const activeValues = activeMeshIndices.map(i => store.diceState.find(d => d.meshIndex === i)?.value ?? 0);

    if (isFarkle(activeValues)) {
      setPhase('farkle');
      return;
    }

    // Hot dice: all dice score — auto-commit them, reset, and go to selecting
    const localIndices = activeMeshIndices.map((_, i) => i);
    if (isHotDice(activeValues, localIndices)) {
      // Select all active dice so commitPendingSelection picks them up
      for (const mi of activeMeshIndices) {
        const d = store.diceState.find(d => d.meshIndex === mi);
        if (d) d.selected = true;
      }
      commitPendingSelection();
      // All 6 dice are now set-aside; un-set-aside them for a fresh roll
      for (const d of store.diceState) {
        d.setAside = false;
        d.selected = false;
        d.value = 0;
      }
      for (const entry of entries) entry.mesh.visible = true;
      clearAllHighlights();
      setPhase('idle');
      return;
    }

    setPhase('selecting');
  }

  function onDiceClick(meshIndex: number) {
    if (currentPhase !== 'selecting') return;
    const d = store.diceState.find(d => d.meshIndex === meshIndex);
    if (!d || d.setAside) return;

    d.selected = !d.selected;

    // Highlight via emissive
    const entry = entries[meshIndex];
    if (entry) {
      const mats = Array.isArray(entry.mesh.material) ? entry.mesh.material : [entry.mesh.material];
      mats.forEach((m: any) => { if (m.emissive) m.emissive.set(d.selected ? 0xaaaaaa : 0x000000); });
    }
  }

  /** Commits currently selected dice to set-aside and tallies their score. */
  function commitPendingSelection(): void {
    const active = store.diceState.filter(d => !d.setAside);
    const activeValues = active.map(d => d.value);
    const combos = detectCombinations(activeValues);
    const selectedLocalIndices = active
      .map((d, i) => (d.selected ? i : -1))
      .filter(i => i !== -1);
    const selectedCombos = combos.filter(c =>
      c.diceIndices.every(i => selectedLocalIndices.includes(i))
    );
    const pts = selectedCombos.reduce((s, c) => s + c.points, 0);
    for (const d of store.diceState) {
      if (d.selected) {
        d.setAside = true;
        d.selected = false;
        // Hide the 3D mesh for set-aside dice
        entries[d.meshIndex].mesh.visible = false;
      }
    }
    store.turnScore += pts;
  }

  function bankTurn() {
    if (currentPhase !== 'selecting') return;
    commitPendingSelection();
    store.totalScore += store.turnScore;
    store.turnScore = 0;
    // Reset all dice for next turn
    for (const d of store.diceState) {
      d.setAside = false; d.selected = false; d.value = 0; d.scoreContribution = 0;
    }
    // Show all dice meshes again for the new turn
    for (const entry of entries) entry.mesh.visible = true;
    clearAllHighlights();
    if (store.totalScore >= store.target) {
      store.screen = 'win';
      return;
    }
    setPhase('idle');
  }

  function startNextTurn() {
    if (currentPhase === 'farkle') {
      store.turnScore = 0;
      for (const d of store.diceState) {
        d.setAside = false; d.selected = false; d.value = 0; d.scoreContribution = 0;
      }
    }
    // Show all dice meshes again
    for (const entry of entries) entry.mesh.visible = true;
    clearAllHighlights();
    setPhase('idle');
  }

  // Wire canvas click → raycast → onDiceClick
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  canvas.addEventListener('click', (event) => {
    if (currentPhase !== 'selecting') return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = entries.map(e => e.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const hitMesh = hits[0].object as THREE.Mesh;
      const meshIndex = hitMesh.userData.meshIndex as number;
      onDiceClick(meshIndex);
    }
  });

  return {
    roll: async (activeMeshIndices) => { await roll(activeMeshIndices); },
    commitAndRoll: async (remainingMeshIndices) => {
      commitPendingSelection();
      await roll(remainingMeshIndices);
    },
    onDiceClick,
    bankTurn,
    startNextTurn,
    dispose: () => {
      cancelAnimationFrame(rafId);
      removeDiceFromScene(entries, scene, world);
      disposeScene(refs); // removes resize listener + disposes renderer
    },
  };
}
