import { initScene, disposeScene } from '../scene/sceneSetup';
import { createDiceEntries, syncMeshesToBodies, type DiceMeshEntry } from '../scene/DiceRenderer';
import { AnimationRecorder } from '../animation/AnimationRecorder';
import { getRolledFace } from '../diceLogic/dice';
import type { AnimationData } from '../animation/animationLibrary';

const MAX_RECORD_SECONDS = 6;

export interface StudioSceneHandle {
  setDiceCount: (n: number) => void;
  startRecording: () => void;
  stopAndSave: () => Promise<AnimationData | null>;
  reset: () => void;
  dispose: () => void;
}

export async function initStudioScene(canvas: HTMLCanvasElement): Promise<StudioSceneHandle> {
  const refs = await initScene(canvas);
  const { scene, world, renderer, camera } = refs;

  let diceCount = 2;
  let entries: DiceMeshEntry[] = [];
  let recorder: AnimationRecorder | null = null;
  let isRecording = false;
  let recordElapsed = 0;
  let animFrameId: number;

  async function spawnDice(n: number) {
    entries.forEach(e => { scene.remove(e.mesh); world.removeBody(e.body); });
    entries = await createDiceEntries(n, scene, world);
    recorder = null;
    isRecording = false;
    recordElapsed = 0;
  }

  await spawnDice(diceCount);

  function launchDice() {
    entries.forEach(e => {
      e.body.position.set((Math.random() - 0.5) * 4, 5, (Math.random() - 0.5) * 4);
      e.body.velocity.set((Math.random() - 0.5) * 10, 5 + Math.random() * 5, (Math.random() - 0.5) * 10);
      e.body.angularVelocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    });
  }

  let lastTime = performance.now();

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.max(0, (now - lastTime) / 1000);
    lastTime = now;
    world.step(1 / 60, dt, 3);
    syncMeshesToBodies(entries);

    if (isRecording) {
      recordElapsed += dt;
      recorder!.captureFrame(recordElapsed);
      if (recordElapsed >= MAX_RECORD_SECONDS) {
        isRecording = false;
      }
    }

    renderer.render(scene, camera);
  }
  animate();

  return {
    setDiceCount: async (n: number) => {
      diceCount = n;
      await spawnDice(n);
    },

    startRecording: () => {
      launchDice();
      recordElapsed = 0;
      recorder = new AnimationRecorder(entries.map(e => e.body));
      isRecording = true;
    },

    stopAndSave: async (): Promise<AnimationData | null> => {
      if (!recorder) return null;
      isRecording = false;

      // Wait until all dice have settled, then detect faces
      const MAX_SETTLE_STEPS = 120;
      for (let s = 0; s < MAX_SETTLE_STEPS; s++) {
        const allSettled = entries.every(e => {
          const v = e.body.velocity.lengthSquared();
          const av = e.body.angularVelocity.lengthSquared();
          return v < 0.01 && av < 0.01;
        });
        if (allSettled) break;
        world.step(1 / 60);
      }
      const finalFaces = entries.map(e => getRolledFace(e.body) || 1);

      const data = recorder.finish(finalFaces);

      const res = await fetch('/api/save-animation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { console.error('Failed to save animation'); return null; }
      return data;
    },

    reset: async () => { await spawnDice(diceCount); },

    dispose: () => {
      cancelAnimationFrame(animFrameId);
      disposeScene(refs);
    },
  };
}
