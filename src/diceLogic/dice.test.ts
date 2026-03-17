import { describe, expect, it } from "vitest";
import * as CANNON from "cannon-es";
import { getRolledFace } from "./dice";

describe("getRolledFace", () => {
  it("returns 1 for identity orientation", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);

    expect(getRolledFace(body)).toBe(1);
  });

  it("returns 6 when cube is flipped upside down", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI);

    expect(getRolledFace(body)).toBe(6);
  });

  it("returns -1 while cube is still moving", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0.2, 0, 0);
    body.angularVelocity.set(0, 0, 0);

    expect(getRolledFace(body)).toBe(-1);
  });
});
