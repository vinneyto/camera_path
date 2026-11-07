import { gaussianObjectId } from "3dgs-tile-webgpu";
import { vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

export function createCloudHoverColorNode(
  base: Node,
  hoveredObjectId: Node<"uint">,
  gain: Node<"float">,
): Node<"vec3"> {
  const color = vec3(base as Node<"vec3">);
  return gaussianObjectId.equal(hoveredObjectId).select(color.mul(gain), color);
}
