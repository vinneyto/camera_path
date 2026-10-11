import { buildComputeNode } from "./build-compute-node";

export function buildCompute(computeNode: unknown): string {
  return buildComputeNode(computeNode).computeShader;
}
