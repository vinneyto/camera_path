import type { GaussianCloud } from "3dgs-tile-webgpu";
import type { Intersection, Object3D, Ray } from "three";
import { Box3, Sphere, Vector3 } from "three/webgpu";

import type { GaussianCloudInstance } from "../../model/gaussian-rendering-backend";
import type {
  SceneSurfaceBounds,
  SceneSurfaceHit,
} from "../../model/scene-surface-types";

export class TileGaussianCloudInstance implements GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds | null;
  readonly object: GaussianCloud;
  private disposed = false;

  constructor(
    cloud: GaussianCloud,
    bounds: readonly [number, number, number, number, number, number],
    private readonly onDispose: () => void,
  ) {
    this.object = cloud;
    cloud.updateWorldMatrix(true, false);
    const sphere = new Box3(
      new Vector3(bounds[0], bounds[1], bounds[2]),
      new Vector3(bounds[3], bounds[4], bounds[5]),
    ).getBoundingSphere(new Sphere());
    sphere.applyMatrix4(cloud.matrixWorld);
    this.bounds = { center: sphere.center.toArray(), radius: sphere.radius };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.dispose();
    this.onDispose();
  }

  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit {
    const normal =
      intersection.face?.normal
        .clone()
        .transformDirection(intersection.object.matrixWorld)
        .normalize() ?? ray.direction.clone().negate().normalize();
    return {
      normal: normal.toArray(),
      position: intersection.point.toArray(),
    };
  }
}
