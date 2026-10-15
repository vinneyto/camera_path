import { context } from "three/tsl";
import {
  WebGPUCoordinateSystem,
  WGSLNodeBuilder,
  type Node,
} from "three/webgpu";

export function buildComputeNode(computeNode: unknown) {
  const renderer = {
    backend: {
      isWebGPUBackend: true,
      utils: { getTextureSampleData: () => ({ primarySamples: 1 }) },
    },
    contextNode: context({}),
    coordinateSystem: WebGPUCoordinateSystem,
    getRenderTarget: () => null,
    getPixelRatio: () => 1,
    getDrawingBufferSize: () => ({ width: 16, height: 16 }),
    hasFeature: () => false,
    hasCompatibility: () => false,
  };
  const builder = new WGSLNodeBuilder(
    computeNode as never,
    renderer as never,
  ) as unknown as {
    build(): void;
    computeShader: string;
    updateBeforeNodes: Node[];
  };
  builder.build();
  return builder;
}
