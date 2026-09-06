import { Camera, PerspectiveCamera, Vector3 } from "three/webgpu";

import type { Vec3 } from "@/entities/project";
import type { SceneSurfaceBounds } from "@/shared/scene-surface";

export function frameSurface(
  camera: Camera,
  bounds: SceneSurfaceBounds,
  setOrbitTarget: (target: Vec3) => void,
) {
  if (!(camera instanceof PerspectiveCamera)) return;
  const center = new Vector3(...bounds.center);
  const radius = Math.max(bounds.radius, 0.1);
  camera.near = Math.max(radius / 10_000, 0.0001);
  camera.far = Math.max(radius * 20, 100);
  camera.position.set(
    center.x + radius * 0.15,
    center.y + radius * 0.35,
    center.z + radius * 2.4,
  );
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  setOrbitTarget(center.toArray() as Vec3);
}
