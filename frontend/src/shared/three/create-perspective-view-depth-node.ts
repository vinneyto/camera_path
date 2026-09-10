import { perspectiveDepthToViewZ, reference } from "three/tsl";
import type { Node, PerspectiveCamera } from "three/webgpu";

export function createPerspectiveViewDepthNode(
  perspectiveDepth: Node,
  camera: PerspectiveCamera,
): Node<"float"> {
  const cameraNear = reference("near", "float", camera);
  const cameraFar = reference("far", "float", camera);
  return perspectiveDepthToViewZ(
    perspectiveDepth,
    cameraNear,
    cameraFar,
  ).negate();
}
