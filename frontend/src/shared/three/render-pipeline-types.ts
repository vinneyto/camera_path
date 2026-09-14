import type { Camera, Node, WebGPURenderer } from "three/webgpu";

export interface RenderPipelineLayerOptions {
  /** Device depth contributed by this layer. One means no geometry. */
  depth?: Node<"float">;
  /** Layers with lower order values are composited first. */
  order?: number;
}

export interface RenderPipelineEffectOptions {
  /** Effects with lower order values are applied first. */
  order?: number;
}

export type RenderPipelineEffectTransform = (
  input: Node<"vec4">,
  sceneDepth: Node<"float">,
) => Node<"vec4">;

export interface SceneRenderPipeline {
  camera: Camera;
  getOpaqueViewDepth: (screenUv: Node) => Node<"float">;
  registerEffect: (
    transform: RenderPipelineEffectTransform,
    options?: RenderPipelineEffectOptions,
  ) => () => void;
  registerLayer: (
    node: Node<"vec4">,
    options?: RenderPipelineLayerOptions,
  ) => () => void;
  renderer: WebGPURenderer;
}

export type RenderPipelineContextValue = SceneRenderPipeline;

export interface RenderPipelineLayer {
  depth: Node<"float"> | undefined;
  node: Node<"vec4">;
  order: number;
  sequence: number;
}

export interface RenderPipelineEffect {
  order: number;
  sequence: number;
  transform: RenderPipelineEffectTransform;
}
