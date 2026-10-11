import type { Node } from "three/webgpu";
import { Fn, If, vec4 } from "three/tsl";

export function createLidarHitNode(
  range: Node<"float">,
  ray: Node<"vec3">,
  worldMatrix: Node<"mat4">,
  maxRange: number,
): Node<"vec4"> {
  return Fn(() => {
    const hit = vec4(0).toVar();
    // Infinity is the no-return sentinel; comparisons also reject NaN.
    If(range.greaterThan(0).and(range.lessThanEqual(maxRange)), () => {
      hit.assign(worldMatrix.mul(vec4(ray.mul(range), 1)));
    });
    return hit;
  })();
}
