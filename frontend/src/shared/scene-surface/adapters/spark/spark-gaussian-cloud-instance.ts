import type { SplatMesh } from "@sparkjsdev/spark";
import type { Intersection, Object3D, Ray } from "three";
import { Sphere } from "three";

import type { GaussianCloudInstance } from "../../model/gaussian-rendering-backend";
import type {
  SceneSurfaceBounds,
  SceneSurfaceHit,
} from "../../model/scene-surface-types";

export class SparkGaussianCloudInstance implements GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds;
  readonly object: SplatMesh;
  private disposed = false;

  constructor(
    mesh: SplatMesh,
    private readonly onDispose: () => void,
  ) {
    this.object = mesh;
    mesh.updateWorldMatrix(true, false);
    const sphere = mesh
      .getBoundingBox()
      .getBoundingSphere(new Sphere())
      .applyMatrix4(mesh.matrixWorld);
    this.bounds = { center: sphere.center.toArray(), radius: sphere.radius };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.dispose();
    this.onDispose();
  }

  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit {
    return {
      normal: ray.direction.clone().negate().normalize().toArray(),
      position: intersection.point.toArray(),
    };
  }

  setRaycastable(raycastable: boolean): void {
    this.object.raycastable = raycastable;
  }
}
