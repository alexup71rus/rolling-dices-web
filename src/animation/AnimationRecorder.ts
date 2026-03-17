import * as CANNON from 'cannon-es';
import type { AnimationData, AnimationFrame } from './animationLibrary';

export class AnimationRecorder {
  private bodies: CANNON.Body[];
  private frames: AnimationFrame[] = [];

  constructor(bodies: CANNON.Body[]) {
    this.bodies = bodies;
  }

  captureFrame(t: number): void {
    this.frames.push({
      t,
      dice: this.bodies.map(b => ({
        px: b.position.x,
        py: b.position.y,
        pz: b.position.z,
        qx: b.quaternion.x,
        qy: b.quaternion.y,
        qz: b.quaternion.z,
        qw: b.quaternion.w,
      })),
    });
  }

  finish(finalFaces: number[]): AnimationData {
    const duration = this.frames.length > 0 ? this.frames[this.frames.length - 1].t : 0;
    return {
      diceCount: this.bodies.length,
      duration,
      finalFaces,
      frames: [...this.frames],
    };
  }

  reset(): void {
    this.frames = [];
  }
}
