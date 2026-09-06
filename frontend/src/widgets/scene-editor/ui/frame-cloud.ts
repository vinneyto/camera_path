import type { GaussianCloud } from "3dgs-tile-webgpu";
import { Camera, PerspectiveCamera, Sphere } from "three/webgpu";

import type { Vec3 } from "@/entities/project";

export function frameCloud(
  camera: Camera,
  cloud: GaussianCloud,
  setOrbitTarget: (target: Vec3) => void,
) {
  if (!(camera instanceof PerspectiveCamera) || cloud.lod === null) return;
  cloud.updateWorldMatrix(true, false);
  const sphere = cloud.lod.octree.bounds.getBoundingSphere(new Sphere());
  sphere.applyMatrix4(cloud.matrixWorld);
  const radius = Math.max(sphere.radius, 0.1);
  camera.near = Math.max(radius / 10_000, 0.0001);
  camera.far = Math.max(radius * 20, 100);
  camera.position.set(
    sphere.center.x + radius * 0.15,
    sphere.center.y + radius * 0.35,
    sphere.center.z + radius * 2.4,
  );
  camera.lookAt(sphere.center);
  camera.updateProjectionMatrix();
  setOrbitTarget(sphere.center.toArray() as Vec3);
}
