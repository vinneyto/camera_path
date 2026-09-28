import { Box3, Camera, PerspectiveCamera, Vector3 } from "three/webgpu";

import type { Vec3 } from "@/entities/project";
import type { SceneSurfaceBounds } from "@/shared/scene-surface";

export function frameSurface(
  camera: Camera,
  bounds: SceneSurfaceBounds,
  setOrbitTarget: (target: Vec3) => void,
) {
  if (!(camera instanceof PerspectiveCamera)) return;
  const box =
    bounds.min && bounds.max
      ? new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max))
      : null;
  const center = box
    ? box.getCenter(new Vector3())
    : new Vector3(...bounds.center);
  const radius = Math.max(bounds.radius, 0.1);
  const verticalHalfFov = Math.atan(
    Math.tan((camera.fov * Math.PI) / 360) / camera.zoom,
  );
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * camera.aspect,
  );
  let distance =
    radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
  camera.updateWorldMatrix(true, false);
  if (box) {
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const towardCamera = new Vector3().setFromMatrixColumn(
      camera.matrixWorld,
      2,
    );
    distance = 0;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const offset = new Vector3(x, y, z).sub(center);
          distance = Math.max(
            distance,
            offset.dot(towardCamera) +
              Math.max(
                Math.abs(offset.dot(right)) / Math.tan(horizontalHalfFov),
                Math.abs(offset.dot(up)) / Math.tan(verticalHalfFov),
              ),
          );
        }
      }
    }
  }
  distance = Math.max(distance * 1.15, 0.1);
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
