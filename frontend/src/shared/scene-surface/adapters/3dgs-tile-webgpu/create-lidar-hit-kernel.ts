import type {
  Node,
  StorageInstancedBufferAttribute,
  Texture,
} from "three/webgpu";
import {
  Fn,
  instanceIndex,
  storage,
  textureLoad,
  uvec2,
  vec2,
  uint,
} from "three/tsl";
import { createLidarHitNode } from "./create-lidar-hit-node";
import { createLidarRayNode } from "./create-lidar-ray-node";

export function createLidarHitKernel(
  depth: Texture,
  hits: StorageInstancedBufferAttribute,
  worldMatrix: Node<"mat4">,
  width: number,
  height: number,
  verticalFovRadians: number,
  maxRange: number,
) {
  const output = storage(hits, "vec4", width * height);
  return Fn(() => {
    const pixel = uvec2(
      instanceIndex.mod(uint(width)),
      instanceIndex.div(uint(width)),
    );
    const range = textureLoad(depth, pixel).r.toVar();
    const hit = output.element(instanceIndex);
    const ray = createLidarRayNode(
      vec2(pixel),
      width,
      height,
      verticalFovRadians,
    );
    hit.assign(createLidarHitNode(range, ray, worldMatrix, maxRange));
  })().compute(width * height);
}
