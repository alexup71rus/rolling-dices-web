import * as THREE from 'three';
import type { AnimationData, AnimationFrame } from './animationLibrary';
import type { DiceMeshEntry } from '../scene/DiceRenderer';
import { buildRemappedMaterials } from './textureRemap';

export type DieFrameState = {
  px: number; py: number; pz: number;
  qx: number; qy: number; qz: number; qw: number;
};

export function interpolateFrame(frames: AnimationFrame[], t: number): DieFrameState[] {
  if (frames.length === 0) return [];

  const clampedT = Math.max(frames[0].t, Math.min(frames[frames.length - 1].t, t));

  let lo = frames[0];
  let hi = frames[frames.length - 1];
  for (let i = 0; i < frames.length - 1; i++) {
    if (frames[i].t <= clampedT && frames[i + 1].t >= clampedT) {
      lo = frames[i];
      hi = frames[i + 1];
      break;
    }
  }

  const span = hi.t - lo.t;
  const alpha = span === 0 ? 0 : (clampedT - lo.t) / span;

  return lo.dice.map((d, i) => {
    const h = hi.dice[i] ?? d;
    const px = d.px + (h.px - d.px) * alpha;
    const py = d.py + (h.py - d.py) * alpha;
    const pz = d.pz + (h.pz - d.pz) * alpha;
    const qa = new THREE.Quaternion(d.qx, d.qy, d.qz, d.qw);
    const qb = new THREE.Quaternion(h.qx, h.qy, h.qz, h.qw);
    qa.slerp(qb, alpha);
    return { px, py, pz, qx: qa.x, qy: qa.y, qz: qa.z, qw: qa.w };
  });
}

export interface PlaybackHandle {
  stop: () => void;
  promise: Promise<void>;
}

export function playAnimation(
  animData: AnimationData,
  desiredFaces: number[],
  activeEntries: DiceMeshEntry[],
  onComplete: () => void,
): PlaybackHandle {
  activeEntries.forEach((entry, i) => {
    const animFinalFace = animData.finalFaces[i];
    const desiredFace = desiredFaces[i];
    if (animFinalFace !== undefined && desiredFace !== undefined) {
      entry.mesh.material = buildRemappedMaterials(
        entry.baseMaterials,
        animFinalFace,
        desiredFace,
      ) as THREE.Material[];
    }
    entry.body.mass = 0;
    entry.body.updateMassProperties();
  });

  const startTime = performance.now();
  let rafId: number;
  let stopped = false;

  let resolvePromise!: () => void;
  const promise = new Promise<void>(res => { resolvePromise = res; });

  function tick() {
    if (stopped) return;
    const elapsed = (performance.now() - startTime) / 1000;
    const t = Math.min(elapsed, animData.duration);

    const states = interpolateFrame(animData.frames, t);
    states.forEach((s, i) => {
      const { mesh, body } = activeEntries[i];
      mesh.position.set(s.px, s.py, s.pz);
      mesh.quaternion.set(s.qx, s.qy, s.qz, s.qw);
      body.position.set(s.px, s.py, s.pz);
      body.quaternion.set(s.qx, s.qy, s.qz, s.qw);
    });

    if (elapsed >= animData.duration) {
      activeEntries.forEach(entry => {
        entry.body.mass = 1;
        entry.body.updateMassProperties();
        entry.body.velocity.setZero();
        entry.body.angularVelocity.setZero();
      });
      onComplete();
      resolvePromise();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return {
    stop: () => { stopped = true; cancelAnimationFrame(rafId); resolvePromise(); },
    promise,
  };
}
