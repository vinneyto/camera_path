import { InstancedMesh, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import { LIDAR_HIT_RADIUS } from "./constants";
import { SceneDepthLidar } from "./scene-depth-lidar";

it("uses one shared, closed sphere geometry for all instanced hit markers", () => {
  const lidar = new SceneDepthLidar(
    { capture: vi.fn(), dispose: vi.fn() },
    { horizontalResolution: 16, verticalResolution: 4, verticalFovDegrees: 60 },
  );
  expect(lidar.object).toBeInstanceOf(InstancedMesh);
  expect(lidar.object.instanceMatrix.count).toBe(64);
  const geometry = lidar.object.geometry;
  geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new Vector3());
  const center = geometry.boundingBox!.getCenter(new Vector3());
  for (const extent of size.toArray())
    expect(extent).toBeCloseTo(2 * LIDAR_HIT_RADIUS, 6);
  expect(center.length()).toBeCloseTo(0, 6);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const vertex = new Vector3(),
    outward = new Vector3();
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    outward.fromBufferAttribute(normal, i);
    expect(vertex.length()).toBeCloseTo(LIDAR_HIT_RADIUS, 6);
    expect(outward.dot(vertex.clone().normalize())).toBeCloseTo(1, 6);
  }
  lidar.dispose();
});
