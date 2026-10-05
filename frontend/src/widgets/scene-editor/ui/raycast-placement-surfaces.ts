import type { Object3D, Raycaster } from "three";
import type { SceneSurfaceHit } from "@/shared/scene-surface";

export function raycastPlacementSurfaces(
  scene: Object3D,
  raycaster: Raycaster,
): SceneSurfaceHit | null {
  scene.updateMatrixWorld(true);
  const targets: Object3D[] = [];
  scene.traverseVisible((object) => {
    if (object.userData.sceneSurfacePickable) targets.push(object);
  });
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return null;
  return {
    position: hit.point.toArray(),
    normal:
      hit.face?.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .toArray() ?? raycaster.ray.direction.clone().negate().toArray(),
  };
}
