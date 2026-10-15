import { createLidarHitNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-lidar-hit-node";
import { createLidarRayNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/create-lidar-ray-node";
import {
  Fn,
  If,
  bool,
  instanceIndex,
  storage,
  textureLoad,
  uint,
  uvec2,
  vec2,
  vec4,
} from "three/tsl";
import type {
  Node,
  StorageInstancedBufferAttribute,
  Texture,
} from "three/webgpu";

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
