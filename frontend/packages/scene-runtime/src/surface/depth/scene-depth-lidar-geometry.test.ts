import { InstancedBufferGeometry, MeshBasicMaterial } from "three";
import { expect, it } from "vitest";
import { createLidarHitMesh } from "./create-lidar-hit-mesh";
it("uses an instanced quad for analytic spheres without allocating CPU instance matrices", () => {
  const material = new MeshBasicMaterial(),
    object = createLidarHitMesh(material, {
      horizontalResolution: 512,
      verticalResolution: 64,
      verticalFovDegrees: 60,
    });
  try {
    expect(object.geometry).toBeInstanceOf(InstancedBufferGeometry);
    expect(object.geometry.instanceCount).toBe(32768);
    expect(object.geometry.getAttribute("position").count).toBe(4);
    expect(object.geometry.index!.count).toBe(6);
    expect(Object.keys(object.geometry.attributes).sort()).toEqual([
      "normal",
      "position",
      "uv",
    ]);
    expect("instanceMatrix" in object).toBe(false);
    expect(object.userData.excludeFromSceneDepth).toBe(true);
    expect(object.frustumCulled).toBe(false);
  } finally {
    object.geometry.dispose();
    material.dispose();
  }
});
