import { describe, expect, it } from "vitest";
import { Object3D, Raycaster, Vector3 } from "three";

import { enableAdditionalObjectLayers } from "./enable-additional-object-layers";

describe("enableAdditionalObjectLayers", () => {
  it("keeps the default layer and enables every additional layer", () => {
    const object = new Object3D();

    enableAdditionalObjectLayers(object, [2, 4]);

    expect(object.layers.isEnabled(0)).toBe(true);
    expect(object.layers.isEnabled(2)).toBe(true);
    expect(object.layers.isEnabled(4)).toBe(true);
  });

  it("keeps default-layer editor objects out of an additional-layer raycast", () => {
    const anchor = new Object3D();
    const surface = new Object3D();
    anchor.raycast = (_raycaster, intersections) => {
      intersections.push({
        distance: 1,
        object: anchor,
        point: new Vector3(0, 0, -1),
      });
    };
    surface.raycast = (_raycaster, intersections) => {
      intersections.push({
        distance: 2,
        object: surface,
        point: new Vector3(0, 0, -2),
      });
    };
    enableAdditionalObjectLayers(surface, [2]);
    const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
    raycaster.layers.set(2);

    const hit = raycaster.intersectObjects([anchor, surface])[0];

    expect(hit?.object).toBe(surface);
  });
});
