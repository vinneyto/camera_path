import { Vector3 } from "three";
import { DEPTH_CUBE_FACES, DEPTH_FAR, DEPTH_NEAR } from "./constants";
import type { SceneDepthCube } from "./scene-depth-capture";

/** Nearest texel, never interpolate a hit with a miss or across surfaces.
 * Convert linear face view-Z to radial range along the actual angular-bin ray.
 */
export function sampleDepthCube(
  cube: SceneDepthCube,
  rays: Float32Array,
  output: Float32Array,
): void {
  const forward = new Vector3(),
    up = new Vector3(),
    right = new Vector3();
  for (let i = 0; i < output.length; i++) {
    const x = rays[i * 3],
      y = rays[i * 3 + 1],
      z = rays[i * 3 + 2];
    const ax = Math.abs(x),
      ay = Math.abs(y),
      az = Math.abs(z);
    const face =
      ax >= ay && ax >= az
        ? x >= 0
          ? 0
          : 1
        : ay >= az
          ? y >= 0
            ? 2
            : 3
          : z >= 0
            ? 4
            : 5;
    forward.fromArray(DEPTH_CUBE_FACES[face].forward);
    up.fromArray(DEPTH_CUBE_FACES[face].up);
    right.crossVectors(forward, up);
    const d = x * forward.x + y * forward.y + z * forward.z;
    const u = (x * right.x + y * right.y + z * right.z) / d;
    const v = (x * up.x + y * up.y + z * up.z) / d;
    const px = Math.min(
      cube.size - 1,
      Math.max(0, Math.floor((u * 0.5 + 0.5) * cube.size)),
    );
    const py = Math.min(
      cube.size - 1,
      Math.max(0, Math.floor((0.5 - v * 0.5) * cube.size)),
    );
    const viewZ = cube.faces[face][py * cube.size + px];
    const range = viewZ / d;
    output[i] =
      viewZ >= DEPTH_NEAR && Number.isFinite(range) && range <= DEPTH_FAR
        ? range
        : Infinity;
  }
}
