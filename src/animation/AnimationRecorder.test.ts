import { describe, expect, it } from 'vitest';
import * as CANNON from 'cannon-es';
import { AnimationRecorder } from './AnimationRecorder';

function makeBody(): CANNON.Body {
  const body = new CANNON.Body({ mass: 1, shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)) });
  body.position.set(0, 5, 0);
  body.velocity.set(1, 2, 0);
  return body;
}

describe('AnimationRecorder', () => {
  it('captures frames after stepping', () => {
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    const body = makeBody();
    world.addBody(body);

    const recorder = new AnimationRecorder([body]);
    for (let i = 0; i < 10; i++) {
      world.step(1 / 60);
      recorder.captureFrame(i / 60);
    }

    const data = recorder.finish([4]);
    expect(data.frames.length).toBe(10);
    expect(data.diceCount).toBe(1); // derived from bodies.length
    expect(data.finalFaces).toEqual([4]);
    expect(data.frames[0].dice[0].py).not.toBe(0); // physics ran — position moved from origin
  });

  it('serialises to valid AnimationData shape', () => {
    const body = makeBody();
    const recorder = new AnimationRecorder([body]);
    recorder.captureFrame(0);
    const data = recorder.finish([2]);
    expect(data).toMatchObject({
      diceCount: 1,
      finalFaces: [2],
      frames: expect.arrayContaining([
        expect.objectContaining({
          t: expect.any(Number),
          dice: expect.arrayContaining([
            expect.objectContaining({ px: expect.any(Number), qw: expect.any(Number) }),
          ]),
        }),
      ]),
    });
  });
});
