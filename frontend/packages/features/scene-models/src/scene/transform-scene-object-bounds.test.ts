import { expect, it } from "vitest";

import { Euler, Matrix4, Quaternion, Vector3 } from "three";

import { transformSceneObjectBounds } from "@camera-path/feature-scene-models/scene/transform-scene-object-bounds";

it("applies the resolved scene matrix to bounds", () => {
  const cloud = new Matrix4().compose(
    new Vector3(12, 0, 0),
    new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0)),
    new Vector3(2, 2, 2),
  );
  const result = transformSceneObjectBounds(
    { center: [1, 0, 0], radius: 3, min: [0, -1, -1], max: [2, 1, 1] },
    cloud,
  );

  expect(result.center[0]).toBeCloseTo(12);
  expect(result.center[1]).toBeCloseTo(0);
  expect(result.center[2]).toBeCloseTo(-2);
  expect(result.radius).toBeCloseTo(6);
  expect(result.min?.[0]).toBeCloseTo(10);
  expect(result.max?.[0]).toBeCloseTo(14);
  expect(result.min?.[2]).toBeCloseTo(-4);
  expect(result.max?.[2]).toBeCloseTo(0);
});
