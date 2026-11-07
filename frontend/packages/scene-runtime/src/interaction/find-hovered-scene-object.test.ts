import { HOVERABLE } from "@camera-path/render-pipeline";
import { Group, Mesh, Vector3, type Intersection } from "three";
import { describe, expect, it } from "vitest";
import { findHoveredSceneObject } from "./find-hovered-scene-object";

function hit(object: Mesh, distance = 1): Intersection {
  return { object, distance, point: new Vector3() };
}

describe("logical hover targets", () => {
  it("uses the nearest marked ancestor with an ID, starting at the hit itself", () => {
    const outer = new Group();
    outer.layers.enable(HOVERABLE);
    outer.userData.sceneObjectID = "outer";
    const inner = new Group();
    inner.layers.enable(HOVERABLE);
    inner.userData.sceneObjectID = "inner";
    const mesh = new Mesh();
    outer.add(inner);
    inner.add(mesh);
    expect(findHoveredSceneObject([hit(mesh)])).toBe(inner);
    mesh.layers.enable(HOVERABLE);
    mesh.userData.sceneObjectID = "mesh";
    expect(findHoveredSceneObject([hit(mesh)])).toBe(mesh);
  });

  it("requires both a marker and a nonempty string ID on the same node", () => {
    const parent = new Group();
    parent.layers.enable(HOVERABLE);
    parent.userData.sceneObjectID = "parent";
    const mesh = new Mesh();
    parent.add(mesh);
    mesh.userData.sceneObjectID = "unmarked";
    expect(findHoveredSceneObject([hit(mesh)])).toBe(parent);
    mesh.layers.enable(HOVERABLE);
    for (const invalid of [undefined, null, 42, "", "  "]) {
      mesh.userData.sceneObjectID = invalid;
      expect(findHoveredSceneObject([hit(mesh)])).toBe(parent);
    }
  });

  it("does not fall through an unmarked first intersection", () => {
    const blocker = new Mesh();
    const behind = new Mesh();
    behind.layers.enable(HOVERABLE);
    behind.userData.sceneObjectID = "behind";
    expect(findHoveredSceneObject([hit(blocker), hit(behind, 2)])).toBeNull();
    expect(findHoveredSceneObject([])).toBeNull();
  });
});
