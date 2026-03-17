import { describe, expect, it } from "vitest";
import * as CANNON from "cannon-es";
import { getRolledFace } from "./dice";

describe("getRolledFace", () => {
  it("returns 1 for identity orientation (face 1 = +Y)", () => {
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

  it("returns 5 when -X faces up (90° around -Z)", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, -1), Math.PI / 2);

    expect(getRolledFace(body)).toBe(5);
  });

  it("returns 2 when +X faces up (90° around +Z)", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);

    expect(getRolledFace(body)).toBe(2);
  });

  it("returns 4 when -Z faces up (90° around +X)", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);

    expect(getRolledFace(body)).toBe(4);
  });

  it("returns 3 when +Z faces up (90° around -X)", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI / 2);

    expect(getRolledFace(body)).toBe(3);
  });

  it("returns -1 while cube is still moving", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0.2, 0, 0);
    body.angularVelocity.set(0, 0, 0);

    expect(getRolledFace(body)).toBe(-1);
  });

  it("returns -1 while cube has angular velocity", () => {
    const body = new CANNON.Body({ mass: 1 });
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0.2, 0);

    expect(getRolledFace(body)).toBe(-1);
  });
});
