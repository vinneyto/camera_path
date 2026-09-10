import type { GaussianCloud } from "3dgs-tile-webgpu";
import { Object3D, Raycaster, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { TileGaussianCloudInstance } from "./tile-gaussian-cloud-instance";

describe("TileGaussianCloudInstance raycasting", () => {
  it("lets a farther trajectory hit win while the cloud is disabled", () => {
    const cloud = new Object3D() as GaussianCloud;
    Object.assign(cloud, {
      dispose: vi.fn(),
      lod: null,
      raycast: vi.fn((_raycaster, intersections) => {
        intersections.push({
          distance: 1,
          object: cloud,
          point: new Vector3(0, 0, -1),
        });
      }),
    });
    const trajectory = new Object3D();
    trajectory.raycast = vi.fn((_raycaster, intersections) => {
      intersections.push({
        distance: 2,
        object: trajectory,
        point: new Vector3(0, 0, -2),
      });
    });
    const instance = new TileGaussianCloudInstance(cloud, false, vi.fn());
    const raycaster = new Raycaster(new Vector3(), new Vector3(0, 0, -1));

    expect(raycaster.intersectObjects([cloud, trajectory])[0]?.object).toBe(
      trajectory,
    );

    instance.setRaycastable(true);

    expect(raycaster.intersectObjects([cloud, trajectory])[0]?.object).toBe(
      cloud,
    );
  });
});
