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
  const verticalHalfFov = Math.atan(
    Math.tan((camera.fov * Math.PI) / 360) / camera.zoom,
  );
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * camera.aspect,
  );
  const distance =
    (radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov))) * 1.15;
  const direction = camera.getWorldDirection(new Vector3()).negate();
  if (direction.lengthSq() < 1e-8) direction.set(0.2, 0.35, 1);
  direction.normalize();
  camera.near = Math.max((distance - radius) / 100, 0.0001);
  camera.far = Math.max(distance + radius * 4, 100);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  setOrbitTarget(center.toArray() as Vec3);
}
