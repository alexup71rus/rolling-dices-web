// src/game/GameSceneController.ts
import * as THREE from 'three';
import type { SceneRefs } from '../scene/sceneSetup';
import type { DiceMeshEntry } from '../scene/DiceRenderer';
import type { GameStore } from './gameState';
import type { DieType } from './diceModifiers';
import { createDie, performRoll, buildModifiersFromConfig } from './diceModifiers';
import { detectCombinations, isFarkle } from './scoring';
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
  deselectAll: () => void;
  moveFocus: (direction: 'left' | 'right' | 'up' | 'down') => void;
  toggleFocusedSelection: () => void;
  getPhase: () => TurnPhase;
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

  // Render loop + hover animation
  let rafId: number;
  /** Animated hover transition state. null = no animation running. */
  let hoverAnim: { fromX: number; fromZ: number; toX: number; toZ: number; targetIdx: number; start: number; duration: number } | null = null;
  const HOVER_ANIM_MS = 120;

  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop);
    // Tick hover animation
    if (hoverAnim) {
      const t = Math.min(1, (performance.now() - hoverAnim.start) / hoverAnim.duration);
      const ease = t * (2 - t); // ease-out quad
      const entry = entries[hoverAnim.targetIdx];
      if (entry?.hoverMesh) {
        const x = hoverAnim.fromX + (hoverAnim.toX - hoverAnim.fromX) * ease;
        const z = hoverAnim.fromZ + (hoverAnim.toZ - hoverAnim.fromZ) * ease;
        entry.hoverMesh.position.set(x, 0.012, z);
        entry.hoverMesh.visible = true;
      }
      if (t >= 1) hoverAnim = null;
    }
    renderer.render(scene, camera);
  }
  renderLoop();

  function setPhase(p: TurnPhase) {
    currentPhase = p;
    onPhaseChange(p);
  }

  /** Resets highlight on every die mesh. */
  function clearAllHighlights() {
    for (const entry of entries) {
      if (entry.highlightMesh) {
        entry.highlightMesh.visible = false;
      }
    }
  }

  /** Hide all hover highlights. */
  function clearAllHovers() {
    for (const entry of entries) {
      if (entry.hoverMesh) {
        entry.hoverMesh.visible = false;
      }
    }
  }

  /** Keyboard/hover focus tracking. -1 means no focus. */
  let focusedIndex = -1;

  /** Get active (non-set-aside, visible) mesh indices. */
  function getActiveMeshIndices(): number[] {
    return store.diceState.filter(d => !d.setAside).map(d => d.meshIndex);
  }

  /** Shows hover highlight on a specific die instantly (mouse). */
  function setHoverHighlight(meshIndex: number) {
    hoverAnim = null; // cancel any running animation
    clearAllHovers();
    focusedIndex = meshIndex;
    if (currentPhase !== 'selecting') return;
    const entry = entries[meshIndex];
    if (entry && entry.hoverMesh && entry.mesh.visible) {
      entry.hoverMesh.visible = true;
      entry.hoverMesh.position.set(entry.mesh.position.x, 0.012, entry.mesh.position.z);
    }
  }

  /** Animates hover highlight from current position to target die (keyboard). */
  function animateHoverTo(meshIndex: number) {
    if (currentPhase !== 'selecting') return;
    const targetEntry = entries[meshIndex];
    if (!targetEntry?.hoverMesh || !targetEntry.mesh.visible) return;

    // Determine start position: previous focused die or target itself
    let fromX = targetEntry.mesh.position.x;
    let fromZ = targetEntry.mesh.position.z;
    if (focusedIndex >= 0) {
      const prevEntry = entries[focusedIndex];
      if (prevEntry?.hoverMesh?.visible) {
        fromX = prevEntry.hoverMesh.position.x;
        fromZ = prevEntry.hoverMesh.position.z;
      } else if (prevEntry?.mesh) {
        fromX = prevEntry.mesh.position.x;
        fromZ = prevEntry.mesh.position.z;
      }
    }

    // Hide all hovers, then show only the target one for animation
    clearAllHovers();
    targetEntry.hoverMesh.visible = true;
    focusedIndex = meshIndex;

    hoverAnim = {
      fromX, fromZ,
      toX: targetEntry.mesh.position.x,
      toZ: targetEntry.mesh.position.z,
      targetIdx: meshIndex,
      start: performance.now(),
      duration: HOVER_ANIM_MS,
    };
  }

  /** Clears hover focus. */
  function clearHoverHighlight() {
    hoverAnim = null;
    focusedIndex = -1;
    clearAllHovers();
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

    setPhase('selecting');
  }

  function onDiceClick(meshIndex: number) {
    if (currentPhase !== 'selecting') return;
    const d = store.diceState.find(d => d.meshIndex === meshIndex);
    if (!d || d.setAside) return;

    d.selected = !d.selected;

    // Highlight via outline
    const entry = entries[meshIndex];
    if (entry && entry.highlightMesh) {
      entry.highlightMesh.visible = d.selected;
      if (d.selected) {
        entry.highlightMesh.position.set(entry.mesh.position.x, 0.015, entry.mesh.position.z);
      }
    }
  }

  /** Deselect all active dice. */
  function deselectAll() {
    if (currentPhase !== 'selecting') return;
    for (const d of store.diceState) {
      if (!d.setAside) d.selected = false;
    }
    clearAllHighlights();
  }

  /**
   * Move keyboard focus based on spatial positions of dice meshes.
   * Finds the nearest neighbour in the pressed direction.
   */
  function moveFocus(direction: 'left' | 'right' | 'up' | 'down') {
    const active = getActiveMeshIndices();
    if (active.length === 0) return;

    // No current focus → pick the spatially leftmost die
    if (focusedIndex === -1 || !active.includes(focusedIndex)) {
      const sorted = [...active].sort((a, b) => entries[a].mesh.position.x - entries[b].mesh.position.x);
      animateHoverTo(sorted[0]);
      return;
    }

    const cur = entries[focusedIndex].mesh.position;
    let bestIdx = -1;
    let bestScore = Infinity;

    for (const idx of active) {
      if (idx === focusedIndex) continue;
      const pos = entries[idx].mesh.position;
      const dx = pos.x - cur.x;
      const dz = pos.z - cur.z;

      // Check if this die is in the desired direction
      let inDirection = false;
      switch (direction) {
        case 'right': inDirection = dx > 0.05; break;
        case 'left':  inDirection = dx < -0.05; break;
        // In 3D scene, camera looks from +z toward -z, so "up" = smaller z, "down" = larger z
        case 'up':    inDirection = dz < -0.05; break;
        case 'down':  inDirection = dz > 0.05; break;
      }
      if (!inDirection) continue;

      // Score: primary axis distance + penalty for perpendicular offset
      const isHorizontal = direction === 'left' || direction === 'right';
      const primary = isHorizontal ? Math.abs(dx) : Math.abs(dz);
      const perp = isHorizontal ? Math.abs(dz) : Math.abs(dx);
      const score = primary + perp * 2; // penalise off-axis candidates

      if (score < bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    }

    // If nothing found in that direction, wrap around to the opposite extreme
    if (bestIdx === -1) {
      const sorted = [...active].sort((a, b) => {
        const pa = entries[a].mesh.position;
        const pb = entries[b].mesh.position;
        switch (direction) {
          case 'right': return pa.x - pb.x;     // pick leftmost
          case 'left':  return pb.x - pa.x;     // pick rightmost
          case 'down':  return pa.z - pb.z;     // pick top-most
          case 'up':    return pb.z - pa.z;     // pick bottom-most
        }
      });
      bestIdx = sorted[0];
      if (bestIdx === focusedIndex && sorted.length > 1) bestIdx = sorted[1];
    }

    if (bestIdx !== -1 && bestIdx !== focusedIndex) {
      animateHoverTo(bestIdx);
    }
  }

  /** Toggle selection on the currently focused die. */
  function toggleFocusedSelection() {
    if (focusedIndex === -1) return;
    onDiceClick(focusedIndex);
  }

  /** Commits currently selected dice to set-aside and tallies their score. */
  function commitPendingSelection(): void {
    const active = store.diceState.filter(d => !d.setAside);
    const selected = active.filter(d => d.selected);
    const selectedValues = selected.map(d => d.value);
    const combos = detectCombinations(selectedValues);
    const pts = combos.reduce((s, c) => s + c.points, 0);
    for (const d of store.diceState) {
      if (d.selected) {
        d.setAside = true;
        d.selected = false;
        // Hide the 3D mesh for set-aside dice
        entries[d.meshIndex].mesh.visible = false;
        if (entries[d.meshIndex].highlightMesh) {
          entries[d.meshIndex].highlightMesh!.visible = false;
        }
        if (entries[d.meshIndex].hoverMesh) {
          entries[d.meshIndex].hoverMesh!.visible = false;
        }
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
    clearAllHovers();
    focusedIndex = -1;
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
    clearAllHovers();
    focusedIndex = -1;
    setPhase('idle');
  }

  // Wire canvas click → raycast → onDiceClick
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function raycastDie(event: MouseEvent): number | null {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const meshes = entries.filter(e => e.mesh.visible).map(e => e.mesh);
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      return hits[0].object.userData.meshIndex as number;
    }
    return null;
  }

  canvas.addEventListener('click', (event) => {
    if (currentPhase !== 'selecting') return;
    const meshIndex = raycastDie(event);
    if (meshIndex !== null) onDiceClick(meshIndex);
  });

  // Hover tracking for mouse
  canvas.addEventListener('mousemove', (event) => {
    if (currentPhase !== 'selecting') {
      clearHoverHighlight();
      return;
    }
    const meshIndex = raycastDie(event);
    if (meshIndex !== null) {
      setHoverHighlight(meshIndex);
    } else {
      clearHoverHighlight();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    clearHoverHighlight();
  });

  return {
    roll: async (activeMeshIndices) => { await roll(activeMeshIndices); },
    commitAndRoll: async (remainingMeshIndices) => {
      commitPendingSelection();
      if (remainingMeshIndices.length === 0) {
        // Hot dice: all dice scored — reset and roll all 6
        for (const d of store.diceState) {
          d.setAside = false;
          d.selected = false;
          d.value = 0;
        }
        for (const entry of entries) entry.mesh.visible = true;
        clearAllHighlights();
        clearAllHovers();
        focusedIndex = -1;
        await roll(store.diceState.map(d => d.meshIndex));
      } else {
        await roll(remainingMeshIndices);
      }
    },
    onDiceClick,
    bankTurn,
    startNextTurn,
    deselectAll,
    moveFocus,
    toggleFocusedSelection,
    getPhase: () => currentPhase,
    dispose: () => {
      cancelAnimationFrame(rafId);
      removeDiceFromScene(entries, scene, world);
      disposeScene(refs);
    },
  };
}
