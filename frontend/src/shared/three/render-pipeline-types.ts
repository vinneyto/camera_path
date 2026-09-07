import type { Camera, Node, WebGPURenderer } from "three/webgpu";

export interface RenderPipelineLayerOptions {
  /** Layers with lower order values are composited first. */
  order?: number;
}

export interface SceneRenderPipeline {
  camera: Camera;
  getOpaqueViewDepth: (screenUv: Node) => Node<"float">;
  registerLayer: (
    node: Node<"vec4">,
    options?: RenderPipelineLayerOptions,
  ) => () => void;
  renderer: WebGPURenderer;
}

export type RenderPipelineContextValue = SceneRenderPipeline;

export interface RenderPipelineLayer {
  node: Node<"vec4">;
  order: number;
  sequence: number;
}
