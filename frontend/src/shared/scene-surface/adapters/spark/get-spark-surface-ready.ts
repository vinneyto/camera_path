import type { SplatMesh } from "@sparkjsdev/spark";
import { Sphere } from "three";

import type { SceneSurfaceReady } from "../../model/scene-surface-types";

export function getSparkSurfaceReady(mesh: SplatMesh): SceneSurfaceReady {
  mesh.updateWorldMatrix(true, false);
  const sphere = mesh.getBoundingBox().getBoundingSphere(new Sphere()).applyMatrix4(mesh.matrixWorld);
  return {
    bounds: {
      center: sphere.center.toArray(),
      radius: sphere.radius,
    },
  };
}
