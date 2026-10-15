import { float, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";

/** Centers of angular bins: +X right, +Y up, camera forward -Z. */
export function createLidarRayNode(
  pixel: Node<"vec2">,
  width: number,
  height: number,
  verticalFovRadians: number,
): Node<"vec3"> {
  const azimuth = pixel.x
    .add(0.5)
    .div(width)
    .sub(0.5)
    .mul(2 * Math.PI);
  const elevation = float(0.5)
    .sub(pixel.y.add(0.5).div(height))
    .mul(verticalFovRadians);
  return vec3(
    azimuth.sin().mul(elevation.cos()),
    elevation.sin(),
    azimuth.cos().negate().mul(elevation.cos()),
  );
}
