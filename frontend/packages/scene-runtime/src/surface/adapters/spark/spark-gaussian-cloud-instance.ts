import type { SplatMesh } from "@sparkjsdev/spark";
import type { Intersection, Object3D, Ray } from "three";
import { Sphere } from "three";
import { selectGaussianInteractionGain } from "../../select-gaussian-interaction-gain";

import type { GaussianCloudInstance } from "@camera-path/scene-runtime/surface/model/gaussian-rendering-backend";
import type {
  SceneSurfaceBounds,
  SceneSurfaceHit,
} from "@camera-path/scene-runtime/surface/model/scene-surface-types";

export class SparkGaussianCloudInstance implements GaussianCloudInstance {
  readonly bounds: SceneSurfaceBounds;
  readonly object: SplatMesh;
  private disposed = false;
  private interactionGain = 1;

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

  setInteractionState(hovered: boolean, selected: boolean): void {
    const gain = selectGaussianInteractionGain(hovered, selected);
    if (this.disposed || this.interactionGain === gain) return;
    this.object.recolor.multiplyScalar(gain / this.interactionGain);
    this.interactionGain = gain;
  }

  getHit(intersection: Intersection<Object3D>, ray: Ray): SceneSurfaceHit {
    return {
      normal: ray.direction.clone().negate().normalize().toArray(),
      position: intersection.point.toArray(),
    };
  }
}
