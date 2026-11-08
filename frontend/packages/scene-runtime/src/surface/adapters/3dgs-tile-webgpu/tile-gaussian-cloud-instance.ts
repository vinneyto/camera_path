import type { GaussianCloud } from "3dgs-tile-webgpu";
import type { Intersection, Object3D, Ray } from "three";
import { Box3, Matrix3, Sphere } from "three/webgpu";

import type { GaussianCloudInstance } from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type {
  SceneSurfaceBounds,
  SceneSurfaceHit,
} from "@camera-path/scene-runtime/surface/model/scene-surface-types";

export class TileGaussianCloudInstance implements GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds | null;
  readonly object: GaussianCloud;
  private disposed = false;

  constructor(
    cloud: GaussianCloud,
    bounds: readonly [number, number, number, number, number, number],
    private readonly onDispose: () => void,
    private readonly onInteractionState: (
      hovered: boolean,
      selected: boolean,
    ) => void = () => undefined,
  ) {
    this.object = cloud;
    cloud.updateWorldMatrix(true, false);
    const box = new Box3().setFromArray(bounds).applyMatrix4(cloud.matrixWorld);
    const sphere = box.getBoundingSphere(new Sphere());
    this.bounds = {
      center: sphere.center.toArray(),
      radius: sphere.radius,
      min: box.min.toArray(),
      max: box.max.toArray(),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onInteractionState(false, false);
    this.object.dispose();
    this.onDispose();
  }

  setInteractionState(hovered: boolean, selected: boolean): void {
    if (!this.disposed) this.onInteractionState(hovered, selected);
  }

  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit {
    const normal =
      intersection.face?.normal
        .clone()
        .applyMatrix3(
          new Matrix3().getNormalMatrix(intersection.object.matrixWorld),
        )
        .normalize() ?? ray.direction.clone().negate().normalize();
    return {
      normal: normal.toArray(),
      position: intersection.point.toArray(),
    };
  }
}
