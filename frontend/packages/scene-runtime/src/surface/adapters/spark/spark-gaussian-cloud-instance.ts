import type { SplatMesh } from "@sparkjsdev/spark";
import type { Intersection, Object3D, Ray } from "three";
import { Sphere } from "three";
import { GAUSSIAN_HOVER_GAIN } from "../../constants";

import type { GaussianCloudInstance } from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type {
  SceneSurfaceBounds,
  SceneSurfaceHit,
} from "@camera-path/scene-runtime/surface/model/scene-surface-types";

export class SparkGaussianCloudInstance implements GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds;
  readonly object: SplatMesh;
  private disposed = false;
  private hovered = false;

  constructor(
    mesh: SplatMesh,
    private readonly onDispose: () => void,
  ) {
    this.object = mesh;
    mesh.updateWorldMatrix(true, false);
    const box = mesh.getBoundingBox().clone().applyMatrix4(mesh.matrixWorld);
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
    this.object.dispose();
    this.onDispose();
  }

  setHovered(hovered: boolean): void {
    if (this.disposed || this.hovered === hovered) return;
    this.object.recolor.multiplyScalar(
      hovered ? GAUSSIAN_HOVER_GAIN : 1 / GAUSSIAN_HOVER_GAIN,
    );
    this.hovered = hovered;
  }

  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit {
    return {
      normal: ray.direction.clone().negate().normalize().toArray(),
      position: intersection.point.toArray(),
    };
  }
}
