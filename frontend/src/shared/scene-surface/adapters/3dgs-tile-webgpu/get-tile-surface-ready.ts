import type { GaussianCloud } from "3dgs-tile-webgpu";
import { Sphere } from "three/webgpu";

import type { SceneSurfaceReady } from "../../model/scene-surface-types";

export function getTileSurfaceReady(cloud: GaussianCloud): SceneSurfaceReady | null {
  if (cloud.lod === null) return null;
  cloud.updateWorldMatrix(true, false);
  const sphere = cloud.lod.octree.bounds.getBoundingSphere(new Sphere());
  sphere.applyMatrix4(cloud.matrixWorld);
  return {
    bounds: {
      center: sphere.center.toArray(),
      radius: sphere.radius,
    },
  };
}
