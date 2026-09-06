import type { Camera, Node, WebGPURenderer } from "three/webgpu";

export interface RenderPipelineLayerOptions {
  /** Layers with lower order values are composited first. */
  order?: number;
}

export interface RenderPipelineContextValue {
  camera: Camera;
  getOpaqueViewDepth: (pixelCoordinate: Node) => Node<"float">;
  registerLayer: (
    node: Node<"vec4">,
    options?: RenderPipelineLayerOptions,
  ) => () => void;
  renderer: WebGPURenderer;
}

export interface RenderPipelineLayer {
  node: Node<"vec4">;
  order: number;
  sequence: number;
}
