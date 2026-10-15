import { buildComputeNode } from "@camera-path/scene-runtime/surface/adapters/3dgs-tile-webgpu/test-helpers/build-compute-node";

export function buildCompute(computeNode: unknown): string {
  return buildComputeNode(computeNode).computeShader;
}
