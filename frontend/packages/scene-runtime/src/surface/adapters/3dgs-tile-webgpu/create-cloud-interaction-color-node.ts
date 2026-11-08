import { gaussianObjectId } from "3dgs-tile-webgpu";
import { vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

export function createCloudInteractionColorNode(
  base: Node,
  hoveredObjectId: Node<"uint">,
  gain: Node<"float">,
  selectedObjectId: Node<"uint">,
  selectedGain: Node<"float">,
): Node<"vec3"> {
  const color = vec3(base as Node<"vec3">);
  return selectedGain
    .greaterThan(1)
    .and(gaussianObjectId.equal(selectedObjectId))
    .select(
      color.mul(selectedGain),
      gaussianObjectId.equal(hoveredObjectId).select(color.mul(gain), color),
    );
}
