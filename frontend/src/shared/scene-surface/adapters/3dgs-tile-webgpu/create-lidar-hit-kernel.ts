import type {
  Node,
  StorageInstancedBufferAttribute,
  Texture,
} from "three/webgpu";
import {
  Fn,
  If,
  bool,
  vec4,
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
  outputReady?: Node<"bool">,
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
    If(outputReady ?? bool(true), () => {
      hit.assign(createLidarHitNode(range, ray, worldMatrix, maxRange));
    }).Else(() => {
      // Old depth belongs to an earlier pose; suppress it during overflow.
      hit.assign(vec4(0));
    });
  })().compute(width * height);
}
