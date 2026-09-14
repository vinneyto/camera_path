import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";

import { forEachCenterWeightedAutofocusRay } from "./for-each-center-weighted-autofocus-ray";

describe("forEachCenterWeightedAutofocusRay", () => {
  it("emits the center ray first and all nine weighted samples", () => {
    const camera = new PerspectiveCamera(50, 1.5, 0.1, 100);
    camera.position.set(2, 3, 4);
    camera.lookAt(2, 3, 3);
    camera.updateMatrixWorld(true);
    const raycaster = new Raycaster();
    const rays: Array<{ direction: Vector3; weight: number }> = [];

    forEachCenterWeightedAutofocusRay(
      camera,
      raycaster,
      { pointer: new Vector2(), principalPoint: new Vector3() },
      (current, sample) => {
        rays.push({
          direction: current.ray.direction.clone(),
          weight: sample.weight,
        });
      },
    );

    expect(rays).toHaveLength(9);
    expect(rays[0].weight).toBe(6);
    expect(rays[0].direction.toArray()).toEqual([0, 0, -1]);
    expect(new Set(rays.slice(1).map((ray) => ray.weight))).toEqual(
      new Set([1, 2]),
    );
  });
});
