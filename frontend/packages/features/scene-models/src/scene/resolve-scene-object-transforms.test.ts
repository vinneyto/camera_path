import { expect, it } from "vitest";
import { Vector3 } from "three";
import type { SceneObject } from "@camera-path/types/api";
import { resolveSceneObjectTransforms } from "./resolve-scene-object-transforms";

it("composes an unsorted hierarchy without losing nonuniform scale or shear", () => {
  const parent = {
    id: "parent",
    parent_id: null,
    visible: true,
    position: [10, 0, 0],
    quaternion: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
    scale: [2, 3, 4],
  } as SceneObject;
  const child = {
    id: "child",
    parent_id: "parent",
    visible: true,
    position: [1, 2, 0],
    quaternion: [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
    scale: [1, 2, 1],
  } as SceneObject;
  const result = resolveSceneObjectTransforms([child, parent]);
  const matrix = result.get("child")!.matrix;
  const origin = new Vector3().applyMatrix4(matrix);
  expect(origin.x).toBeCloseTo(4);
  expect(origin.y).toBeCloseTo(2);
  const point = new Vector3(1, 0, 0).applyMatrix4(matrix);
  expect(point.x).toBeCloseTo(4 - 3 * Math.SQRT1_2);
  expect(point.y).toBeCloseTo(2 + 2 * Math.SQRT1_2);
  const hidden = resolveSceneObjectTransforms([
    child,
    { ...parent, visible: false },
  ]);
  expect(hidden.get("child")!.visible).toBe(false);
  expect(child.position).toEqual([1, 2, 0]);
});
