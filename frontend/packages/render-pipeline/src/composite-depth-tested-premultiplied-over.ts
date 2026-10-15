import { vec4 } from "three/tsl";
import type { Node } from "three/webgpu";

import { compositePremultipliedOver } from "./composite-premultiplied-over";

export function compositeDepthTestedPremultipliedOver(
  base: Node<"vec4">,
  overlay: Node<"vec4">,
  baseViewZ: Node<"float">,
  overlayViewZ: Node<"float">,
): Node<"vec4"> {
  const visibleOverlay = overlayViewZ
    .greaterThanEqual(baseViewZ)
    .select(vec4(overlay), vec4(0));
  return compositePremultipliedOver(base, visibleOverlay);
}
