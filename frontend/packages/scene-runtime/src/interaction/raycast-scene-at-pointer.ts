import {
  Vector2,
  type Camera,
  type Object3D,
  type Raycaster,
  type Scene,
} from "three";
import { NDC_MIN, NDC_MAX, NDC_SPAN } from "./constants";

export function raycastSceneAtPointer(
  raycaster: Raycaster,
  {
    camera,
    scene,
  }: { camera: Camera & { near: number; far: number }; scene: Scene },
  rect: DOMRect,
  { clientX, clientY }: Pick<PointerEvent, "clientX" | "clientY">,
) {
  if (
    rect.width === 0 ||
    rect.height === 0 ||
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  )
    return [];
  const pointer = new Vector2(
    ((clientX - rect.left) / rect.width) * NDC_SPAN + NDC_MIN,
    -((clientY - rect.top) / rect.height) * NDC_SPAN + NDC_MAX,
  );
  scene.updateMatrixWorld();
  camera.updateWorldMatrix(true, false);
  raycaster.setFromCamera(pointer, camera);
  raycaster.near = camera.near;
  raycaster.far = camera.far;
  // Raycaster does not skip invisible ancestors. Traverse once, without recursion.
  const objects: Object3D[] = [];
  scene.traverseVisible((object) => objects.push(object));
  return raycaster.intersectObjects(objects, false);
}
