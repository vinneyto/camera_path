import { describe, expect, it } from "vitest";
import { Euler, PerspectiveCamera } from "three";

import { activateTrajectoryCamera } from "./activate-trajectory-camera";

describe("activateTrajectoryCamera", () => {
  it("restores the previous orbit pose and projection", () => {
    const camera = new PerspectiveCamera(42, 1.5, 0.03, 240);
    camera.position.set(4, 5, 6);
    camera.quaternion.setFromEuler(new Euler(0.1, 0.2, 0.3));
    camera.up.set(0, 0, 1);
    camera.zoom = 1.4;
    const expected = {
      far: camera.far,
      fov: camera.fov,
      near: camera.near,
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      up: camera.up.clone(),
      zoom: camera.zoom,
    };

    const restore = activateTrajectoryCamera(camera);
    camera.position.set(10, 20, 30);
    camera.quaternion.identity();
    camera.up.set(0, 1, 0);
    restore();

    expect(camera.position.toArray()).toEqual(expected.position.toArray());
    expect(camera.quaternion.toArray()).toEqual(expected.quaternion.toArray());
    expect(camera.up.toArray()).toEqual(expected.up.toArray());
    expect(camera.fov).toBe(expected.fov);
    expect(camera.near).toBe(expected.near);
    expect(camera.far).toBe(expected.far);
    expect(camera.zoom).toBe(expected.zoom);
  });
});
